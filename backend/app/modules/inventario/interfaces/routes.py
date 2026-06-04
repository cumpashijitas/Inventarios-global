"""Endpoints HTTP del módulo inventario."""

from __future__ import annotations

import mimetypes
import os
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.config import settings
from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context, require_modulo
from app.modules.inventario.application.almacenes_uc import AlmacenesUseCases
from app.modules.inventario.application.clientes_uc import ClientesUseCases
from app.modules.inventario.application.productos_uc import ProductosUseCases
from app.modules.inventario.application.proveedores_uc import ProveedoresUseCases
from app.modules.inventario.application.stock_uc import StockUseCases
from app.modules.inventario.interfaces.schemas import (
    AjusteStockIn,
    AlmacenIn,
    AlmacenOut,
    CategoriaIn,
    CategoriaOut,
    CategoriaUpdate,
    ClienteIn,
    ClienteOut,
    ClienteUpdate,
    ImagenProductoOut,
    MovimientoOut,
    PageOut,
    ProductoIn,
    ProductoOut,
    ProductoUpdate,
    ProveedorIn,
    ProveedorOut,
    ProveedorUpdate,
    StockOut,
    UnidadMedidaOut,
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


@router.get("/productos/stock-bajo", response_model=list[dict])
async def listar_stock_bajo(
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[dict]:
    from app.modules.inventario.infrastructure.productos_repo import ProductosRepository
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        repo = ProductosRepository(conn)
        return await repo.list_stock_bajo(UUID(ctx.empresa_id))


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


@router.post("/productos/{producto_id}/imagen", response_model=ImagenProductoOut)
async def subir_imagen_producto(
    producto_id: UUID,
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(get_tenant_context),
) -> ImagenProductoOut:
    """Sube la imagen del producto a Supabase Storage y actualiza imagen_url en la DB."""
    BUCKET = "productos"
    MAX_BYTES = 5 * 1024 * 1024  # 5 MB

    # Normalizar content-type (browsers a veces envían 'image/jpg')
    _ct_map = {"image/jpg": "image/jpeg"}
    ct_raw = (file.content_type or "").lower().split(";")[0].strip()
    ct = _ct_map.get(ct_raw, ct_raw)

    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if ct not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo no permitido: '{ct}'. Soportados: JPEG, PNG, WEBP, GIF.",
        )

    # Leer contenido (con límite de tamaño)
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen no puede superar 5 MB.",
        )

    _ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    ext = _ext_map.get(ct, ".jpg")
    storage_path = f"{ctx.empresa_id}/{producto_id}{ext}"
    object_url = f"{settings.supabase_url}/storage/v1/object/{BUCKET}/{storage_path}"
    public_url  = f"{settings.supabase_url}/storage/v1/object/public/{BUCKET}/{storage_path}"

    svc_headers = {"Authorization": f"Bearer {settings.supabase_service_role_key}"}

    async with httpx.AsyncClient(timeout=30) as http:
        # 1. Garantizar que el bucket existe (idempotente — 400 si ya existe, no pasa nada)
        await http.post(
            f"{settings.supabase_url}/storage/v1/bucket",
            json={"id": BUCKET, "name": BUCKET, "public": True},
            headers={**svc_headers, "Content-Type": "application/json"},
        )

        # 2. Subir/reemplazar el objeto (POST + x-upsert es el método correcto de Supabase)
        resp = await http.post(
            object_url,
            content=content,
            headers={
                **svc_headers,
                "Content-Type": ct,
                "x-upsert": "true",
                "Cache-Control": "3600",
            },
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase Storage respondió {resp.status_code}: {resp.text}",
        )

    # 3. Actualizar imagen_url en el producto
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProductosUseCases(conn)
        await uc.actualizar(
            UUID(ctx.empresa_id),
            UUID(ctx.user_id),
            producto_id,
            {"imagen_url": public_url},
        )

    return ImagenProductoOut(imagen_url=public_url)


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


# ----------------------------- Proveedores -----------------------------
@router.get("/proveedores", response_model=PageOut)
async def listar_proveedores(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str | None = Query(None),
    only_active: bool = Query(True),
    ctx: TenantContext = Depends(get_tenant_context),
) -> PageOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProveedoresUseCases(conn)
        result = await uc.listar(UUID(ctx.empresa_id), page, page_size, search, only_active)
    return PageOut(**result)


@router.get("/proveedores/{proveedor_id}", response_model=ProveedorOut)
async def obtener_proveedor(
    proveedor_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> ProveedorOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProveedoresUseCases(conn)
        prov = await uc.obtener(proveedor_id)
    return ProveedorOut(**prov)


@router.post("/proveedores", response_model=ProveedorOut, status_code=status.HTTP_201_CREATED)
async def crear_proveedor(
    body: ProveedorIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> ProveedorOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProveedoresUseCases(conn)
        prov = await uc.crear(UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump())
    return ProveedorOut(**prov)


@router.patch("/proveedores/{proveedor_id}", response_model=ProveedorOut)
async def actualizar_proveedor(
    proveedor_id: UUID,
    body: ProveedorUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
) -> ProveedorOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProveedoresUseCases(conn)
        prov = await uc.actualizar(UUID(ctx.empresa_id), UUID(ctx.user_id), proveedor_id, body.model_dump(exclude_unset=True))
    return ProveedorOut(**prov)


@router.delete("/proveedores/{proveedor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_proveedor(
    proveedor_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> None:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ProveedoresUseCases(conn)
        await uc.eliminar(UUID(ctx.empresa_id), UUID(ctx.user_id), proveedor_id)


# ----------------------------- Clientes -----------------------------
@router.get("/clientes", response_model=PageOut)
async def listar_clientes(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str | None = Query(None),
    tipo: str | None = Query(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> PageOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ClientesUseCases(conn)
        result = await uc.listar(UUID(ctx.empresa_id), page, page_size, search, tipo)
    return PageOut(**result)


@router.get("/clientes/{cliente_id}", response_model=ClienteOut)
async def obtener_cliente(
    cliente_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> ClienteOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ClientesUseCases(conn)
        cli = await uc.obtener(cliente_id)
    return ClienteOut(**cli)


@router.post("/clientes", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
async def crear_cliente(
    body: ClienteIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> ClienteOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ClientesUseCases(conn)
        cli = await uc.crear(UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump())
    return ClienteOut(**cli)


@router.patch("/clientes/{cliente_id}", response_model=ClienteOut)
async def actualizar_cliente(
    cliente_id: UUID,
    body: ClienteUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
) -> ClienteOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ClientesUseCases(conn)
        cli = await uc.actualizar(UUID(ctx.empresa_id), UUID(ctx.user_id), cliente_id, body.model_dump(exclude_unset=True))
    return ClienteOut(**cli)


@router.delete("/clientes/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_cliente(
    cliente_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> None:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = ClientesUseCases(conn)
        await uc.eliminar(UUID(ctx.empresa_id), UUID(ctx.user_id), cliente_id)


# ----------------------------- Categorías -----------------------------
@router.get("/categorias", response_model=list[CategoriaOut])
async def listar_categorias(
    only_active: bool = Query(True),
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[CategoriaOut]:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        rows = await conn.fetch(
            """
            SELECT id, nombre, parent_id, orden, activo
              FROM public.categorias
             WHERE empresa_id = $1
               AND ($2 = false OR activo = true)
             ORDER BY orden, nombre
            """,
            UUID(ctx.empresa_id),
            only_active,
        )
    return [CategoriaOut(**dict(r)) for r in rows]


@router.post("/categorias", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
async def crear_categoria(
    body: CategoriaIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> CategoriaOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO public.categorias (empresa_id, nombre, parent_id, orden)
            VALUES ($1, $2, $3, $4)
            RETURNING id, nombre, parent_id, orden, activo
            """,
            UUID(ctx.empresa_id),
            body.nombre,
            body.parent_id,
            body.orden,
        )
    return CategoriaOut(**dict(row))


@router.patch("/categorias/{categoria_id}", response_model=CategoriaOut)
async def actualizar_categoria(
    categoria_id: UUID,
    body: CategoriaUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
) -> CategoriaOut:
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nada que actualizar")

    set_clauses = [f"{col} = ${i + 2}" for i, col in enumerate(updates)]
    values = list(updates.values())
    # empresa_id ocupa la última posición
    empresa_param = f"${len(values) + 2}"

    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        row = await conn.fetchrow(
            f"""
            UPDATE public.categorias
               SET {', '.join(set_clauses)}
             WHERE id = $1
               AND empresa_id = {empresa_param}
               AND deleted_at IS NULL
            RETURNING id, nombre, parent_id, orden, activo
            """,
            categoria_id,
            *values,
            UUID(ctx.empresa_id),
        )
    if not row:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return CategoriaOut(**dict(row))


@router.delete("/categorias/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_categoria(
    categoria_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> None:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        result = await conn.execute(
            """
            UPDATE public.categorias
               SET deleted_at = now(), activo = false
             WHERE id = $1
               AND empresa_id = $2
               AND deleted_at IS NULL
            """,
            categoria_id,
            UUID(ctx.empresa_id),
        )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Categoría no encontrada")


# ----------------------------- Unidades de Medida -----------------------------
@router.get("/unidades", response_model=list[UnidadMedidaOut])
async def listar_unidades(
    only_active: bool = Query(True),
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[UnidadMedidaOut]:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        rows = await conn.fetch(
            """
            SELECT id, codigo, nombre, decimales, activo
              FROM public.unidades_medida
             WHERE empresa_id = $1
               AND ($2 = false OR activo = true)
             ORDER BY codigo
            """,
            UUID(ctx.empresa_id),
            only_active,
        )
    return [UnidadMedidaOut(**dict(r)) for r in rows]
