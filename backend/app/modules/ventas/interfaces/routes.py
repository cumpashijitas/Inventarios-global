"""Endpoints HTTP — módulo ventas."""
from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context, require_modulo
from app.modules.ventas.application.ventas_uc import CotizacionesUseCases, VentasUseCases
from app.modules.ventas.interfaces.schemas import (
    AnularVentaIn,
    CambiarEstadoCotizacionIn,
    CotizacionIn,
    CotizacionOut,
    PageOut,
    VentaIn,
    VentaOut,
)

router = APIRouter(
    prefix="/ventas",
    tags=["ventas"],
    dependencies=[Depends(require_modulo("ventas"))],
)


# ─── IMPORTANTE: rutas estáticas ANTES de rutas con path param ────────────────
# Si /cotizaciones va DESPUÉS de /{venta_id}, FastAPI intenta parsear
# "cotizaciones" como UUID → 422. Las rutas fijas deben declararse primero.


# ─── Top productos (sidebar de ventas) ────────────────────────────────────────
@router.get("/top-productos")
async def top_productos(
    dias: int = Query(30, ge=1, le=365),
    limit: int = Query(5, ge=1, le=20),
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[dict]:
    desde = date.today() - timedelta(days=dias)
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        rows = await conn.fetch(
            """
            select vi.sku, vi.nombre,
                   sum(vi.cantidad)  as cantidad_vendida,
                   sum(vi.subtotal)  as total_vendido
              from public.ventas_items vi
              join public.ventas v on v.id = vi.venta_id
             where v.empresa_id = $1
               and v.fecha >= $2
               and v.estado = 'completada'
             group by vi.sku, vi.nombre
             order by total_vendido desc
             limit $3
            """,
            UUID(ctx.empresa_id), desde, limit,
        )
    return [dict(r) for r in rows]


# ─── Cotizaciones ─────────────────────────────────────────────────────────────
@router.get("/cotizaciones", response_model=PageOut)
async def listar_cotizaciones(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    estado: str | None = Query(None),
    search: str | None = Query(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> PageOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CotizacionesUseCases(conn)
        result = await uc.listar(UUID(ctx.empresa_id), page, page_size, estado, search)
    return PageOut(**result)


@router.get("/cotizaciones/{cotizacion_id}", response_model=CotizacionOut)
async def obtener_cotizacion(
    cotizacion_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> CotizacionOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CotizacionesUseCases(conn)
        cot = await uc.obtener(cotizacion_id)
    return CotizacionOut(**cot)


@router.post("/cotizaciones", response_model=CotizacionOut, status_code=status.HTTP_201_CREATED)
async def crear_cotizacion(
    body: CotizacionIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> CotizacionOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CotizacionesUseCases(conn)
        cot = await uc.crear(UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump())
    return CotizacionOut(**cot)


@router.patch("/cotizaciones/{cotizacion_id}/estado", response_model=CotizacionOut)
async def cambiar_estado_cotizacion(
    cotizacion_id: UUID,
    body: CambiarEstadoCotizacionIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> CotizacionOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CotizacionesUseCases(conn)
        cot = await uc.actualizar_estado(
            UUID(ctx.empresa_id), UUID(ctx.user_id), cotizacion_id, body.estado
        )
    return CotizacionOut(**cot)


# ─── Ventas ───────────────────────────────────────────────────────────────────
@router.get("", response_model=PageOut)
async def listar_ventas(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str | None = Query(None),
    estado: str | None = Query(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> PageOut:
    # Admin ve todas las ventas; otros roles solo ven las suyas
    user_id_filter = None if ctx.rol == "admin" else UUID(ctx.user_id)
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = VentasUseCases(conn)
        result = await uc.listar(
            UUID(ctx.empresa_id), page, page_size, search, estado, user_id_filter
        )
    return PageOut(**result)


@router.post("", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
async def crear_venta(
    body: VentaIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> VentaOut:
    data = body.model_dump()
    almacen_id = data.pop("almacen_id", None)
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = VentasUseCases(conn)
        if not almacen_id:
            almacen_id = await conn.fetchval(
                "select id from public.almacenes where empresa_id = $1 and activo = true order by created_at limit 1",
                ctx.empresa_id,
            )
        venta = await uc.crear(
            UUID(ctx.empresa_id),
            UUID(ctx.user_id),
            UUID(str(almacen_id)) if almacen_id else None,
            data,
        )
    return VentaOut(**venta)


@router.get("/{venta_id}", response_model=VentaOut)
async def obtener_venta(
    venta_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> VentaOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = VentasUseCases(conn)
        venta = await uc.obtener(venta_id)
    return VentaOut(**venta)


@router.post("/{venta_id}/anular", response_model=VentaOut)
async def anular_venta(
    venta_id: UUID,
    body: AnularVentaIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> VentaOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = VentasUseCases(conn)
        venta = await uc.anular(UUID(ctx.empresa_id), UUID(ctx.user_id), venta_id, body.motivo)
    return VentaOut(**venta)
