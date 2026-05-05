"""Use case: stock consolidado de toda la empresa.

Devuelve una vista flat con producto + almacén + cantidad + costo + valor +
flag bajo_minimo. Soporta filtros por almacén, búsqueda fuzzy y paginación.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg


class StockConsolidadoUseCase:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def listar(
        self,
        empresa_id: UUID,
        page: int = 1,
        page_size: int = 50,
        almacen_id: UUID | None = None,
        search: str | None = None,
        only_low_stock: bool = False,
    ) -> dict[str, Any]:
        where_parts = [
            "sa.empresa_id = $1",
            "p.deleted_at is null",
            "a.deleted_at is null",
        ]
        params: list[Any] = [empresa_id]

        if almacen_id is not None:
            params.append(almacen_id)
            where_parts.append(f"sa.almacen_id = ${len(params)}")

        if search and search.strip():
            params.append(f"%{search.strip().lower()}%")
            where_parts.append(
                f"(lower(p.nombre) like ${len(params)} or lower(p.sku) like ${len(params)})"
            )

        if only_low_stock:
            where_parts.append("sa.cantidad <= p.stock_minimo")

        where = " and ".join(where_parts)

        # Total + agregados
        agg = await self.conn.fetchrow(
            f"""
            select
                count(*) as total,
                coalesce(sum(sa.cantidad * sa.costo_promedio), 0) as valor_total,
                count(*) filter (where sa.cantidad <= p.stock_minimo) as bajo_minimo_count
              from public.stock_actual sa
              join public.productos p on p.id = sa.producto_id
              join public.almacenes a on a.id = sa.almacen_id
             where {where}
            """,
            *params,
        )

        # Página
        offset = (page - 1) * page_size
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"""
            select
                sa.producto_id,
                p.sku,
                p.nombre as producto_nombre,
                p.stock_minimo,
                p.stock_maximo,
                sa.almacen_id,
                a.codigo as almacen_codigo,
                a.nombre as almacen_nombre,
                sa.cantidad,
                sa.costo_promedio,
                (sa.cantidad * sa.costo_promedio) as valor,
                (sa.cantidad <= p.stock_minimo) as bajo_minimo,
                sa.updated_at
              from public.stock_actual sa
              join public.productos p on p.id = sa.producto_id
              join public.almacenes a on a.id = sa.almacen_id
             where {where}
             order by p.nombre, a.nombre
             limit ${len(params) - 1} offset ${len(params)}
            """,
            *params,
        )

        items = [dict(r) for r in rows]

        return {
            "items": items,
            "total": int(agg["total"]),
            "page": page,
            "page_size": page_size,
            "total_pages": (int(agg["total"]) + page_size - 1) // page_size if page_size else 0,
            "valor_total": str(agg["valor_total"]),
            "bajo_minimo_count": int(agg["bajo_minimo_count"]),
        }
