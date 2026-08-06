"""Endpoints HTTP — módulo reportes."""
from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context, require_modulo
from app.modules.reportes.infrastructure.reportes_repo import ReportesRepository

router = APIRouter(
    prefix="/reportes",
    tags=["reportes"],
    dependencies=[Depends(require_modulo("reportes"))],
)


@router.get("/ventas")
async def reporte_ventas(
    desde: date = Query(...),
    hasta: date = Query(...),
    search: str | None = Query(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        repo = ReportesRepository(conn)
        resumen = await repo.resumen_ventas(UUID(ctx.empresa_id), desde, hasta)
        top_productos = await repo.top_productos(
            UUID(ctx.empresa_id), desde, hasta,
            limit=100 if search else 10, search=search,
        )
        por_dia = await repo.ventas_por_dia(UUID(ctx.empresa_id), desde, hasta)
    return {
        "periodo": {"desde": str(desde), "hasta": str(hasta)},
        "resumen": resumen,
        "top_productos": [
            {**p, "cantidad_vendida": float(p["cantidad_vendida"]), "total_vendido": float(p["total_vendido"])}
            for p in top_productos
        ],
        "ventas_por_dia": [
            {"fecha": str(d["fecha"]), "transacciones": int(d["transacciones"]), "total": float(d["total"])}
            for d in por_dia
        ],
    }


@router.get("/ranking-vendedores")
async def ranking_vendedores(
    desde: date = Query(...),
    hasta: date = Query(...),
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        repo = ReportesRepository(conn)
        ranking = await repo.ranking_vendedores(UUID(ctx.empresa_id), desde, hasta)

    items = [
        {
            "user_id": str(r["user_id"]),
            "nombre": r["nombre"],
            "foto_url": r["foto_url"],
            "cantidad_ventas": int(r["cantidad_ventas"]),
            "monto_total": float(r["monto_total"]),
        }
        for r in ranking
    ]
    max_cantidad = max((i["cantidad_ventas"] for i in items), default=0)
    max_monto = max((i["monto_total"] for i in items), default=0.0)
    for i in items:
        i["pct_cantidad"] = round(i["cantidad_ventas"] / max_cantidad * 100, 1) if max_cantidad else 0.0
        i["pct_monto"] = round(i["monto_total"] / max_monto * 100, 1) if max_monto else 0.0

    return {
        "periodo": {"desde": str(desde), "hasta": str(hasta)},
        "vendedores": items,
    }


@router.get("/inventario")
async def reporte_inventario(
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        repo = ReportesRepository(conn)
        resumen = await repo.resumen_inventario(UUID(ctx.empresa_id))
    return {"resumen": resumen}


@router.get("/movimientos")
async def reporte_movimientos(
    desde: date = Query(...),
    hasta: date = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        repo = ReportesRepository(conn)
        movs, total = await repo.movimientos_paginados(
            UUID(ctx.empresa_id), desde, hasta, page, page_size
        )
    total_pages = (total + page_size - 1) // page_size if page_size else 0
    return {
        "periodo": {"desde": str(desde), "hasta": str(hasta)},
        "items": [
            {
                **m,
                "id": str(m["id"]),
                "created_at": m["created_at"].isoformat(),
                "cantidad": float(m["cantidad"]),
                "costo_unitario": float(m["costo_unitario"]),
            }
            for m in movs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/export")
async def exportar_reporte(
    formato: str = Query("pdf", pattern="^(pdf|xlsx)$"),
    desde: date = Query(...),
    hasta: date = Query(...),
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    """
    Exporta el reporte en PDF o Excel.
    TODO: implementar generación real con reportlab (PDF) o openpyxl (Excel).
    """
    return {
        "mensaje": f"Exportación {formato.upper()} pendiente de implementación",
        "periodo": {"desde": str(desde), "hasta": str(hasta)},
        "formato": formato,
    }
