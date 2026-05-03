"""Endpoints HTTP del módulo inventario."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context, require_modulo
from app.modules.inventario.application.almacenes_uc import AlmacenesUseCases
from app.modules.inventario.application.productos_uc import ProductosUseCases
from app.modules.inventario.application.stock_uc import StockUseCases
from app.modules.inventario.interfaces.schemas import (
    AjusteStockIn,
    AlmacenIn,
    AlmacenOut,
    MovimientoOut,
    PageOut,
    ProductoIn,
    ProductoOut,
    ProductoUpdate,
    StockOut,
)

router = APIRouter(
    prefix="/inventario",
    tags=["inventario"],
    dependencies=[Depends(require_modulo("inventario"))],
)


# ----------------------------- Productos -----------------------------
@router.get("/productos", response_model=PageOut)
async def listar_productos(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str | None = Query(None),
    only_active: bool = Query(False),
    ctx: TenantContext = Depends(get_tenant_context),
) -> PageOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProductosUseCases(conn)
        result = await uc.listar(UUID(ctx.empresa_id), page, page_size, search, only_active)
    return PageOut(**result)


@router.get("/productos/{producto_id}", response_model=ProductoOut)
async def obtener_producto(
    producto_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> ProductoOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProductosUseCases(conn)
        prod = await uc.obtener(producto_id)
    return ProductoOut(**prod)


@router.post("/productos", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
async def crear_producto(
    body: ProductoIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> ProductoOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProductosUseCases(conn)
        created = await uc.crear(
            UUID(ctx.empresa_id),
            UUID(ctx.user_id),
            body.model_dump(),
        )
    return ProductoOut(**created)


@router.patch("/productos/{producto_id}", response_model=ProductoOut)
async def actualizar_producto(
    producto_id: UUID,
    body: ProductoUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
) -> ProductoOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProductosUseCases(conn)
        updated = await uc.actualizar(
            UUID(ctx.empresa_id),
            UUID(ctx.user_id),
            producto_id,
            body.model_dump(exclude_unset=True),
        )
    return ProductoOut(**updated)


@router.delete("/productos/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_producto(
    producto_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> None:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProductosUseCases(conn)
        await uc.eliminar(UUID(ctx.empresa_id), UUID(ctx.user_id), producto_id)


# ----------------------------- Almacenes -----------------------------
@router.get("/almacenes", response_model=list[AlmacenOut])
async def listar_almacenes(
    only_active: bool = Query(True),
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[AlmacenOut]:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AlmacenesUseCases(conn)
        items = await uc.listar(UUID(ctx.empresa_id), only_active)
    return [AlmacenOut(**a) for a in items]


@router.post("/almacenes", response_model=AlmacenOut, status_code=status.HTTP_201_CREATED)
async def crear_almacen(
    body: AlmacenIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> AlmacenOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = AlmacenesUseCases(conn)
        created = await uc.crear(UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump())
    return AlmacenOut(**created)


# ----------------------------- Stock / Movimientos -----------------------------
@router.get("/stock/{producto_id}", response_model=list[StockOut])
async def stock_de_producto(
    producto_id: UUID,
    almacen_id: UUID | None = Query(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[StockOut]:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = StockUseCases(conn)
        rows = await uc.stock_de(producto_id, almacen_id)
    return [StockOut(**r) for r in rows]


@router.post("/movimientos", status_code=status.HTTP_201_CREATED)
async def ajustar_stock(
    body: AjusteStockIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = StockUseCases(conn)
        return await uc.ajustar(UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump())


@router.get("/movimientos", response_model=list[MovimientoOut])
async def listar_movimientos(
    producto_id: UUID | None = Query(None),
    almacen_id: UUID | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[MovimientoOut]:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = StockUseCases(conn)
        rows = await uc.listar_movimientos(producto_id, almacen_id, limit)
    return [MovimientoOut(**r) for r in rows]
