"""Endpoints HTTP — módulo lotes (carga masiva)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context, require_modulo
from app.modules.lotes.application.lotes_uc import LotesUseCases
from app.modules.lotes.interfaces.schemas import (
    ItemsIn,
    LoteIn,
    LoteItemIn,
    LoteItemOut,
    LoteOut,
    PageOut,
)

router = APIRouter(
    prefix="/lotes",
    tags=["lotes"],
    dependencies=[Depends(require_modulo("compras"))],
)


@router.get("", response_model=PageOut)
async def listar_lotes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> PageOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = LotesUseCases(conn)
        result = await uc.listar(UUID(ctx.empresa_id), page, page_size, search)
    return PageOut(**result)


@router.get("/{lote_id}", response_model=LoteOut)
async def obtener_lote(
    lote_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> LoteOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = LotesUseCases(conn)
        lote = await uc.obtener(lote_id)
    return LoteOut(**lote)


@router.post("", response_model=LoteOut, status_code=status.HTTP_201_CREATED)
async def crear_lote(
    body: LoteIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> LoteOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = LotesUseCases(conn)
        lote = await uc.crear(UUID(ctx.empresa_id), UUID(ctx.user_id), body.model_dump())
    return LoteOut(**lote)


@router.put("/{lote_id}/items", response_model=list[LoteItemOut])
async def guardar_items_lote(
    lote_id: UUID,
    items: list[LoteItemIn],
    ctx: TenantContext = Depends(get_tenant_context),
) -> list[LoteItemOut]:
    """Reemplaza todos los ítems del lote con la nueva lista (upsert completo)."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = LotesUseCases(conn)
        result = await uc.guardar_items(
            UUID(ctx.empresa_id), lote_id, [i.model_dump() for i in items]
        )
    return [LoteItemOut(**r) for r in result]


@router.post("/{lote_id}/confirmar", response_model=LoteOut)
async def confirmar_lote(
    lote_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> LoteOut:
    """Confirma el lote: crea/actualiza productos y registra entradas de stock."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = LotesUseCases(conn)
        lote = await uc.confirmar(UUID(ctx.empresa_id), UUID(ctx.user_id), lote_id)
    return LoteOut(**lote)


@router.post("/{lote_id}/guardar", response_model=LoteOut)
async def guardar_lote(
    lote_id: UUID,
    body: ItemsIn,
    ctx: TenantContext = Depends(get_tenant_context),
) -> LoteOut:
    """Guarda los ítems y actualiza el inventario en un solo paso."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = LotesUseCases(conn)
        lote = await uc.guardar_y_confirmar(
            UUID(ctx.empresa_id),
            UUID(ctx.user_id),
            lote_id,
            [i.model_dump() for i in body.items],
        )
    return LoteOut(**lote)


@router.delete("/{lote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_lote(
    lote_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
) -> None:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc = LotesUseCases(conn)
        await uc.eliminar(UUID(ctx.empresa_id), UUID(ctx.user_id), lote_id)


@router.post("/parse-archivo")
async def parse_archivo(
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    """
    Lee un PDF, Excel o CSV del proveedor, extrae los productos y los
    compara contra el inventario existente. Devuelve items con match_status.
    """
    from app.modules.lotes.infrastructure.matcher import match_items
    from app.modules.lotes.infrastructure.parser import parse_csv, parse_excel, parse_pdf

    filename = (file.filename or "").lower()
    content  = await file.read()

    # ── 1. Extraer items del archivo ─────────────────────────────────────────
    items: list[dict] = []
    advertencias: list[str] = []

    if filename.endswith(".pdf"):
        items, advertencias = parse_pdf(content)
    elif filename.endswith((".xlsx", ".xls")):
        items, advertencias = parse_excel(content, filename)
    elif filename.endswith(".csv"):
        items, advertencias = parse_csv(content)
    else:
        advertencias.append(
            f"Formato '{filename.rsplit('.', 1)[-1]}' no soportado. "
            "Usa PDF, Excel (.xlsx) o CSV."
        )

    if not items:
        return {
            "filename": file.filename,
            "items_extraidos": 0,
            "items": [],
            "advertencias": advertencias or ["No se pudo extraer ningún producto del archivo."],
        }

    # ── 2. Comparar contra inventario ────────────────────────────────────────
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        items_matcheados = await match_items(conn, UUID(ctx.empresa_id), items)

    return {
        "filename": file.filename,
        "items_extraidos": len(items_matcheados),
        "items": items_matcheados,
        "advertencias": advertencias,
    }
