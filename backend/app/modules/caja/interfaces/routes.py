"""Endpoints HTTP — módulo caja."""
from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context, require_modulo
from app.modules.caja.application.caja_uc import CajaUseCases
from app.modules.caja.interfaces.schemas import (
    AbrirCajaIn,
    CerrarCajaIn,
    HistorialOut,
    MovimientoCajaIn,
    MovimientoOut,
    SesionOut,
    SesionResumenOut,
)

router = APIRouter(
    prefix="/caja",
    tags=["caja"],
    dependencies=[Depends(require_modulo("caja"))],
)


@router.get("/estado", response_model=SesionOut | None)
async def estado_caja(ctx: TenantContext = Depends(get_tenant_context)) -> SesionOut | None:
    """Retorna la sesión de caja actualmente abierta, o null si no hay."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CajaUseCases(conn)
        estado = await uc.estado_actual(UUID(ctx.empresa_id))
    if estado is None:
        return None
    return SesionOut(**estado)


@router.post("/abrir", response_model=SesionOut, status_code=status.HTTP_201_CREATED)
async def abrir_caja(
    body: AbrirCajaIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> SesionOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CajaUseCases(conn)
        sesion = await uc.abrir(UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump())
    return SesionOut(**sesion)


@router.post("/cerrar/{sesion_id}", response_model=SesionOut)
async def cerrar_caja(
    sesion_id: UUID,
    body: CerrarCajaIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> SesionOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CajaUseCases(conn)
        sesion = await uc.cerrar(
            UUID(ctx.empresa_id),
            UUID(ctx.user_id),
            sesion_id,
            float(body.saldo_final),
            body.notas,
        )
    return SesionOut(**sesion)


@router.post("/movimiento", response_model=MovimientoOut, status_code=status.HTTP_201_CREATED)
async def registrar_movimiento(
    body: MovimientoCajaIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> MovimientoOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CajaUseCases(conn)
        mov = await uc.registrar_movimiento(
            UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump()
        )
    return MovimientoOut(**mov)


@router.get("/movimientos", response_model=list[MovimientoOut])
async def listar_movimientos(
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[MovimientoOut]:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CajaUseCases(conn)
        movs = await uc.listar_movimientos(UUID(ctx.empresa_id))
    return [MovimientoOut(**m) for m in movs]


@router.get("/historial", response_model=HistorialOut)
async def historial_caja(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> HistorialOut:
    """Lista todas las sesiones de caja (paginado, con filtro de fechas)."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CajaUseCases(conn)
        result = await uc.historial(UUID(ctx.empresa_id), page, page_size, desde, hasta)
    return HistorialOut(
        items=[SesionResumenOut(**s) for s in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )


@router.get("/sesion/{sesion_id}", response_model=SesionOut)
async def detalle_sesion(
    sesion_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> SesionOut:
    """Detalle completo de una sesión específica (con movimientos)."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CajaUseCases(conn)
        sesion = await uc.detalle_sesion(UUID(ctx.empresa_id), sesion_id)
    if sesion is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"sesión {sesion_id} no encontrada")
    return SesionOut(**sesion)
