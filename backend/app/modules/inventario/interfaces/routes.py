"""Endpoints HTTP del módulo inventario."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context, require_modulo
from app.modules.inventario.application.almacenes_uc import AlmacenesUseCases
from app.modules.inventario.application.categorias_uc import CategoriasUseCases
from app.modules.inventario.application.productos_uc import ProductosUseCases
from app.modules.inventario.application.reportes_uc import ReportesUseCases
from app.modules.inventario.application.stock_consolidado_uc import StockConsolidadoUseCase
from app.modules.inventario.application.stock_uc import StockUseCases
from app.modules.inventario.application.unidades_uc import UnidadesUseCases
from app.modules.inventario.interfaces.schemas import (
    AjusteStockIn,
    AlmacenIn,
    AlmacenOut,
    CategoriaIn,
    CategoriaOut,
    CategoriaUpdate,
    MovimientoOut,
    PageOut,
    ProductoIn,
    ProductoOut,
    ProductoUpdate,
    ReporteBajoStockOut,
    ReporteInventarioOut,
    ReporteMovimientosOut,
    StockConsolidadoPage,
    StockOut,
    UnidadIn,
    UnidadOut,
    UnidadUpdate,
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


# ----------------------------- Stock consolidado -----------------------------
@router.get("/stock", response_model=StockConsolidadoPage)
async def stock_consolidado(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    almacen_id: UUID | None = Query(None),
    search: str | None = Query(None),
    only_low_stock: bool = Query(False),
    ctx: TenantContext = Depends(get_tenant_context),
) -> StockConsolidadoPage:
    """Lista todo el stock_actual de la empresa con filtros y agregados."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = StockConsolidadoUseCase(conn)
        result = await uc.listar(
            UUID(ctx.empresa_id),
            page=page,
            page_size=page_size,
            almacen_id=almacen_id,
            search=search,
            only_low_stock=only_low_stock,
        )
    return StockConsolidadoPage(**result)


# ----------------------------- Categorías -----------------------------
@router.get("/categorias", response_model=list[CategoriaOut])
async def listar_categorias(
    only_active: bool = Query(True),
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[CategoriaOut]:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CategoriasUseCases(conn)
        items = await uc.listar(UUID(ctx.empresa_id), only_active)
    return [CategoriaOut(**c) for c in items]


@router.post("/categorias", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
async def crear_categoria(
    body: CategoriaIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> CategoriaOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CategoriasUseCases(conn)
        created = await uc.crear(UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump())
    return CategoriaOut(**created)


@router.patch("/categorias/{categoria_id}", response_model=CategoriaOut)
async def actualizar_categoria(
    categoria_id: UUID,
    body: CategoriaUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
) -> CategoriaOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CategoriasUseCases(conn)
        updated = await uc.actualizar(
            UUID(ctx.empresa_id),
            UUID(ctx.user_id),
            categoria_id,
            body.model_dump(exclude_unset=True),
        )
    return CategoriaOut(**updated)


@router.delete("/categorias/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_categoria(
    categoria_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> None:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = CategoriasUseCases(conn)
        await uc.eliminar(UUID(ctx.empresa_id), UUID(ctx.user_id), categoria_id)


# ----------------------------- Unidades de medida -----------------------------
@router.get("/unidades", response_model=list[UnidadOut])
async def listar_unidades(
    only_active: bool = Query(True),
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[UnidadOut]:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = UnidadesUseCases(conn)
        items = await uc.listar(UUID(ctx.empresa_id), only_active)
    return [UnidadOut(**u) for u in items]


@router.post("/unidades", response_model=UnidadOut, status_code=status.HTTP_201_CREATED)
async def crear_unidad(
    body: UnidadIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> UnidadOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = UnidadesUseCases(conn)
        created = await uc.crear(UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump())
    return UnidadOut(**created)


@router.patch("/unidades/{unidad_id}", response_model=UnidadOut)
async def actualizar_unidad(
    unidad_id: UUID,
    body: UnidadUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
) -> UnidadOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = UnidadesUseCases(conn)
        updated = await uc.actualizar(
            UUID(ctx.empresa_id),
            UUID(ctx.user_id),
            unidad_id,
            body.model_dump(exclude_unset=True),
        )
    return UnidadOut(**updated)


@router.delete("/unidades/{unidad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def desactivar_unidad(
    unidad_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> None:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = UnidadesUseCases(conn)
        await uc.desactivar(UUID(ctx.empresa_id), UUID(ctx.user_id), unidad_id)


# ----------------------------- Reportes -----------------------------
@router.get("/reportes/inventario", response_model=ReporteInventarioOut)
async def reporte_inventario(
    almacen_id: UUID | None = Query(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> ReporteInventarioOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ReportesUseCases(conn)
        result = await uc.reporte_inventario(UUID(ctx.empresa_id), almacen_id)
    return ReporteInventarioOut(**result)


@router.get("/reportes/movimientos", response_model=ReporteMovimientosOut)
async def reporte_movimientos(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    producto_id: UUID | None = Query(None),
    almacen_id: UUID | None = Query(None),
    tipo: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    ctx: TenantContext = Depends(get_tenant_context),
) -> ReporteMovimientosOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ReportesUseCases(conn)
        result = await uc.reporte_movimientos(
            UUID(ctx.empresa_id),
            desde=desde,
            hasta=hasta,
            producto_id=producto_id,
            almacen_id=almacen_id,
            tipo=tipo,
            page=page,
            page_size=page_size,
        )
    return ReporteMovimientosOut(**result)


@router.get("/reportes/bajo-stock", response_model=ReporteBajoStockOut)
async def reporte_bajo_stock(
    ctx: TenantContext = Depends(get_tenant_context),
) -> ReporteBajoStockOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ReportesUseCases(conn)
        result = await uc.reporte_bajo_stock(UUID(ctx.empresa_id))
    return ReporteBajoStockOut(**result)
