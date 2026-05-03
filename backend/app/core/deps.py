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

from dataclasses import dataclass

from fastapi import Depends, Header

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
# Autorización por módulo (plan/addon)
# -----------------------------------------------------------------------------
def require_modulo(codigo_modulo: str):
    """Genera una dependencia que verifica que la empresa tiene el módulo activo.

    Usa la función SQL `empresa_tiene_modulo(text)` para mantener una sola
    fuente de verdad sobre qué módulos están activos.
    """

    async def _check(ctx: TenantContext = Depends(get_tenant_context)) -> None:
        async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
            # 1. Suscripción vigente
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
                raise PaymentRequiredError("la empresa no tiene suscripción activa")
            if sub["estado"] == "morosa":
                # Permitir lectura pero el frontend debería mostrar banner.
                pass

            # 2. Módulo habilitado (plan o addon)
            tiene = await conn.fetchval(
                "select public.empresa_tiene_modulo($1)", codigo_modulo
            )
            if not tiene:
                # TODO: calcular plan recomendado para upsell
                raise ModuleNotEnabledError(codigo_modulo, upgrade_to=None)

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
