"""Dependencias FastAPI: autenticación, tenant context, autorización por módulo/rol.

Patrón:
    @router.get("/productos", dependencies=[Depends(require_modulo("inventario"))])
    async def list_productos(
        ctx: TenantContext = Depends(get_tenant_context),
        ...
    ):
        async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
            ...

Cascada de validación (de barata a cara):
    1. JWT válido y no expirado
    2. Usuario tiene empresa_id en el JWT
    3. Suscripción de la empresa está vigente
    4. Plan o addon de la empresa incluye el módulo
    5. Rol del usuario tiene el permiso requerido
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request

from app.core.database import acquire_tenant_conn
from app.core.exceptions import (
    ForbiddenError,
    ModuleNotEnabledError,
    PaymentRequiredError,
    UnauthorizedError,
)
from app.core.security import JWTClaims, decode_jwt


@dataclass(frozen=True, slots=True)
class TenantContext:
    """Contexto del request: usuario + empresa + rol."""

    user_id: str
    empresa_id: str
    rol: str | None
    email: str | None


# -----------------------------------------------------------------------------
# Auth: extraer y verificar JWT
# -----------------------------------------------------------------------------
async def get_jwt_claims(authorization: str | None = Header(default=None)) -> JWTClaims:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("falta header Authorization: Bearer <token>")
    token = authorization.split(" ", 1)[1].strip()
    return decode_jwt(token)


# -----------------------------------------------------------------------------
# Tenant context: garantiza que el JWT tiene empresa_id
# -----------------------------------------------------------------------------
async def get_tenant_context(claims: JWTClaims = Depends(get_jwt_claims)) -> TenantContext:
    if not claims.empresa_id:
        raise UnauthorizedError(
            "el JWT no tiene empresa_id. ¿Configuraste la Custom Access Token Hook? "
            "(O selecciona empresa explícitamente en /auth/select-empresa)"
        )
    return TenantContext(
        user_id=claims.sub,
        empresa_id=claims.empresa_id,
        rol=claims.rol,
        email=claims.email,
    )


# -----------------------------------------------------------------------------
# Verificación de IP permitida (whitelist por empresa)
# -----------------------------------------------------------------------------
def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


async def check_ip_access(
    request: Request,
    authorization: str | None = Header(default=None),
) -> None:
    """Verifica que la IP del cliente esté en la whitelist de la empresa.

    Reglas:
    - Sin JWT válido → pasa (el route handler dará 401)
    - Rol admin → siempre pasa
    - Whitelist vacía → sin restricción (feature desactivada)
    - IP en whitelist → pasa
    - IP no en whitelist → 403
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return
    try:
        token = authorization.split(" ", 1)[1].strip()
        claims = decode_jwt(token)
    except Exception:
        return  # Token inválido → el route handler dará 401

    if not claims.empresa_id or claims.rol == "admin":
        return

    client_ip = _get_client_ip(request)

    async with acquire_tenant_conn(claims.empresa_id, claims.sub) as conn:
        rows = await conn.fetch(
            "SELECT ip FROM public.ip_permitidas WHERE empresa_id = $1",
            UUID(claims.empresa_id),
        )

    if not rows:
        return  # Whitelist vacía → sin restricción

    allowed = {row["ip"] for row in rows}
    if client_ip not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Acceso denegado: tu red ({client_ip}) no está autorizada. Contacta al administrador.",
        )


# Cache en memoria: evita ir a Supabase en cada request para verificar suscripción/módulo.
# Clave: "{empresa_id}:{modulo}" → timestamp del último check OK.
# TTL: 60s. Si la suscripción expira, el próximo check tras 60s lo detecta.
_modulo_cache: dict[str, float] = {}
_MODULO_TTL = 60.0


# -----------------------------------------------------------------------------
# Autorización por módulo (plan/addon)
# -----------------------------------------------------------------------------
def require_modulo(codigo_modulo: str):
    """Genera una dependencia que verifica que la empresa tiene el módulo activo."""

    async def _check(ctx: TenantContext = Depends(get_tenant_context)) -> None:
        cache_key = f"{ctx.empresa_id}:{codigo_modulo}"
        ts = _modulo_cache.get(cache_key)
        if ts is not None and time.monotonic() - ts < _MODULO_TTL:
            return  # cache hit — 0 roundtrips a Supabase

        async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
            sub = await conn.fetchrow(
                """
                select estado from public.empresa_suscripciones
                 where empresa_id = $1
                   and estado in ('trial','activa','morosa')
                 limit 1
                """,
                ctx.empresa_id,
            )
            if sub is None:
                _modulo_cache.pop(cache_key, None)
                raise PaymentRequiredError("la empresa no tiene suscripción activa")

            tiene = await conn.fetchval(
                "select public.empresa_tiene_modulo($1)", codigo_modulo
            )
            if not tiene:
                _modulo_cache.pop(cache_key, None)
                raise ModuleNotEnabledError(codigo_modulo, upgrade_to=None)

        _modulo_cache[cache_key] = time.monotonic()

    return _check


# -----------------------------------------------------------------------------
# Autorización por permiso de rol
# -----------------------------------------------------------------------------
def require_permiso(permiso: str):
    """Verifica que el rol del usuario en la empresa tiene el permiso indicado.

    Permisos viven en `roles_empresa.permisos` (jsonb array). Convención:
    `"productos.crear"`, `"ventas.anular"`, etc. El rol especial `"admin"`
    tiene todos los permisos implícitamente.
    """

    async def _check(ctx: TenantContext = Depends(get_tenant_context)) -> None:
        if ctx.rol == "admin":
            return  # admin siempre pasa

        async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
            row = await conn.fetchrow(
                """
                select r.permisos
                  from public.usuarios_empresa ue
                  join public.roles_empresa r on r.id = ue.rol_id
                 where ue.user_id = $1 and ue.empresa_id = $2 and ue.activo = true
                 limit 1
                """,
                ctx.user_id,
                ctx.empresa_id,
            )
        if row is None:
            raise ForbiddenError("usuario no pertenece a esta empresa")
        permisos = row["permisos"] or []
        if permiso not in permisos:
            raise ForbiddenError(f"falta permiso '{permiso}'")

    return _check
