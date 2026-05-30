"""Endpoints HTTP — módulo admin (usuarios, roles, empresa).

Todos los endpoints requieren rol 'admin'. El sistema verifica:
  1. JWT válido con empresa_id (TenantContext)
  2. rol == 'admin' (require_admin)
  3. RLS de Postgres filtra automáticamente por empresa_id
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, status

from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context
from app.core.exceptions import AppError
from app.modules.admin.application.admin_uc import AdminUseCases
from app.modules.admin.interfaces.schemas import (
    EmpresaConfigIn,
    EmpresaConfigOut,
    IpPermitidaIn,
    IpPermitidaOut,
    RolOut,
    SistemaConfigIn,
    SistemaConfigOut,
    UsuarioCreateIn,
    UsuarioOut,
    UsuarioUpdateIn,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def require_admin(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
    """Dependencia: solo el rol 'admin' puede acceder."""
    if ctx.rol != "admin":
        raise AppError("Solo el administrador puede realizar esta acción", 403)
    return ctx


# ─── IP Permitidas ────────────────────────────────────────────────────────────

@router.get("/mi-ip")
async def get_mi_ip(
    request: Request,
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    """Retorna la IP pública desde la que accede el usuario. Útil para registrarla."""
    return {"ip": _get_client_ip(request)}


@router.get("/ip-permitidas", response_model=list[IpPermitidaOut])
async def listar_ips(
    ctx: TenantContext = Depends(require_admin),
) -> list[IpPermitidaOut]:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        ips = await uc.listar_ips(UUID(ctx.empresa_id))
    return [IpPermitidaOut(**ip) for ip in ips]


@router.post("/ip-permitidas", response_model=IpPermitidaOut, status_code=status.HTTP_201_CREATED)
async def agregar_ip(
    body: IpPermitidaIn,
    ctx: TenantContext = Depends(require_admin),
) -> IpPermitidaOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        ip = await uc.agregar_ip(UUID(ctx.empresa_id), body.ip, body.descripcion)
    return IpPermitidaOut(**ip)


@router.delete("/ip-permitidas/{ip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_ip(
    ip_id: UUID,
    ctx: TenantContext = Depends(require_admin),
) -> None:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        await uc.eliminar_ip(UUID(ctx.empresa_id), ip_id)


# ─── Notificaciones ───────────────────────────────────────────────────────────

@router.post("/notificaciones/stock-bajo")
async def enviar_alerta_stock_manual(
    ctx: TenantContext = Depends(require_admin),
) -> dict:
    """
    Botón manual del dashboard — requiere JWT de admin.
    Envía el email de reporte de stock bajo al email de la empresa.
    """
    empresa_id = UUID(ctx.empresa_id)
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        config = await uc.get_sistema_config(empresa_id)
        if not config.get("alertas_stock_bajo", True):
            return {"enviado": False, "motivo": "Las alertas de stock están desactivadas en Configuración"}
        resultado = await uc.enviar_alerta_stock(empresa_id)
    return resultado


@router.post("/cron/stock-bajo")
async def cron_alerta_stock(
    empresa_id: UUID = Query(..., description="ID de la empresa a notificar"),
    x_cron_secret: str = Header(..., alias="X-Cron-Secret"),
) -> dict:
    """
    Endpoint para cron-job.org — autenticado con X-Cron-Secret.
    URL de ejemplo: POST /api/v1/admin/cron/stock-bajo?empresa_id=<UUID>
    Header requerido: X-Cron-Secret: <valor de CRON_SECRET en .env>
    """
    from app.core.config import settings

    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise AppError("Cron secret inválido", 401)

    # Usamos empresa_id como user_id del sistema para el contexto RLS
    async with acquire_tenant_conn(str(empresa_id), str(empresa_id)) as conn:
        uc = AdminUseCases(conn)
        # El cron siempre envía si hay productos bajo mínimo, sin importar el toggle
        resultado = await uc.enviar_alerta_stock(empresa_id)
    return resultado


# ─── Roles ────────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[RolOut])
async def listar_roles(ctx: TenantContext = Depends(require_admin)) -> list[RolOut]:
    """Lista los roles disponibles para la empresa."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        roles = await uc.listar_roles(UUID(ctx.empresa_id))
    return [RolOut(**r) for r in roles]


# ─── Usuarios ──────────────────────────────────────────────────────────────────

@router.get("/usuarios", response_model=list[UsuarioOut])
async def listar_usuarios(ctx: TenantContext = Depends(require_admin)) -> list[UsuarioOut]:
    """Lista todos los usuarios de la empresa."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        usuarios = await uc.listar_usuarios(UUID(ctx.empresa_id))
    return [UsuarioOut(**u) for u in usuarios]


@router.post("/usuarios", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def crear_usuario(
    body: UsuarioCreateIn,
    ctx: TenantContext = Depends(require_admin),
) -> UsuarioOut:
    """
    Crea un nuevo usuario en Supabase Auth y lo asocia a la empresa
    con el rol indicado. La contraseña se establece aquí; el usuario
    puede cambiarla desde su perfil.
    """
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        usuario = await uc.crear_usuario(
            empresa_id=UUID(ctx.empresa_id),
            admin_user_id=UUID(ctx.user_id),
            nombre=body.nombre,
            email=body.email,
            password=body.password,
            rol_codigo=body.rol_codigo,
        )
    return UsuarioOut(**usuario)


@router.put("/usuarios/{usuario_id}", response_model=UsuarioOut)
async def actualizar_usuario(
    usuario_id: UUID,
    body: UsuarioUpdateIn,
    ctx: TenantContext = Depends(require_admin),
) -> UsuarioOut:
    """Actualiza nombre, rol o estado activo de un usuario."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        usuario = await uc.actualizar_usuario(
            empresa_id=UUID(ctx.empresa_id),
            usuario_id=usuario_id,
            nombre=body.nombre,
            rol_codigo=body.rol_codigo,
            activo=body.activo,
        )
    return UsuarioOut(**usuario)


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def desactivar_usuario(
    usuario_id: UUID,
    ctx: TenantContext = Depends(require_admin),
) -> None:
    """Desactiva un usuario (no lo elimina de Supabase Auth)."""
    # No puede desactivarse a sí mismo
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        usuario = await conn.fetchrow(
            "SELECT user_id FROM public.usuarios_empresa WHERE id=$1 AND empresa_id=$2",
            usuario_id, UUID(ctx.empresa_id),
        )
        if not usuario:
            raise AppError("Usuario no encontrado", 404)
        if str(usuario["user_id"]) == ctx.user_id:
            raise AppError("No puedes desactivar tu propia cuenta", 400)
        uc = AdminUseCases(conn)
        await uc.desactivar_usuario(UUID(ctx.empresa_id), usuario_id)


# ─── Empresa ──────────────────────────────────────────────────────────────────

# ─── Sistema ──────────────────────────────────────────────────────────────────

@router.get("/sistema", response_model=SistemaConfigOut)
async def get_sistema(ctx: TenantContext = Depends(get_tenant_context)) -> SistemaConfigOut:
    """
    Devuelve la configuración del sistema para esta empresa.
    Accesible a cualquier usuario autenticado (el dashboard la necesita).
    Solo el PUT requiere ser admin.
    """
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        cfg = await uc.get_sistema_config(UUID(ctx.empresa_id))
    return SistemaConfigOut(**cfg)


@router.put("/sistema", response_model=SistemaConfigOut)
async def actualizar_sistema(
    body: SistemaConfigIn,
    ctx: TenantContext = Depends(require_admin),
) -> SistemaConfigOut:
    """Actualiza las preferencias del sistema (toggles)."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        cfg = await uc.actualizar_sistema_config(
            UUID(ctx.empresa_id),
            body.model_dump(exclude_none=True),
        )
    return SistemaConfigOut(**cfg)


@router.get("/empresa", response_model=EmpresaConfigOut)
async def get_empresa(ctx: TenantContext = Depends(require_admin)) -> EmpresaConfigOut:
    """Obtiene la configuración de la empresa."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        empresa = await uc.get_empresa(UUID(ctx.empresa_id))
    return EmpresaConfigOut(**empresa)


@router.put("/empresa", response_model=EmpresaConfigOut)
async def actualizar_empresa(
    body: EmpresaConfigIn,
    ctx: TenantContext = Depends(require_admin),
) -> EmpresaConfigOut:
    """Actualiza los datos de configuración de la empresa."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AdminUseCases(conn)
        empresa = await uc.actualizar_empresa(
            UUID(ctx.empresa_id),
            body.model_dump(exclude_none=True),
        )
    return EmpresaConfigOut(**empresa)
