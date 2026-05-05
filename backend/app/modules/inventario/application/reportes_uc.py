"""Use cases para reportes básicos del módulo inventario.

3 reportes:
    1. Reporte de inventario  → valorización + KPIs + top + por categoría
    2. Reporte de movimientos → kardex consolidado con filtros
    3. Bajo stock             → productos por debajo del mínimo + sugerencia reorden

Todas las queries respetan RLS (empresa_id viene del session GUC).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

import asyncpg


class ReportesUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    # -------------------------------------------------------------------
    # 1. Reporte de inventario
    # -------------------------------------------------------------------
    async def reporte_inventario(
        self, empresa_id: UUID, almacen_id: UUID | None = None
    ) -> dict[str, Any]:
        almacen_filter = ""
        params: list[Any] = [empresa_id]
        if almacen_id:
            params.append(almacen_id)
            almacen_filter = "and sa.almacen_id = $2"

        # KPIs principales
        kpis = await self.conn.fetchrow(
            f"""
            select
              count(distinct sa.producto_id) as productos_con_stock,
              count(*)                       as combinaciones,
              coalesce(sum(sa.cantidad), 0)                                 as unidades_totales,
              coalesce(sum(sa.cantidad * sa.costo_promedio), 0)             as valor_total,
              count(*) filter (where sa.cantidad <= p.stock_minimo)         as bajo_minimo_count
              from public.stock_actual sa
              join public.productos p on p.id = sa.producto_id
             where sa.empresa_id = $1 and p.deleted_at is null
               {almacen_filter}
            """,
            *params,
        )

        # Top 10 productos por valor inmovilizado
        top_valor = await self.conn.fetch(
            f"""
            select p.id, p.sku, p.nombre,
                   sum(sa.cantidad)                          as cantidad,
                   sum(sa.cantidad * sa.costo_promedio)      as valor
              from public.stock_actual sa
              join public.productos p on p.id = sa.producto_id
             where sa.empresa_id = $1 and p.deleted_at is null
               {almacen_filter}
             group by p.id, p.sku, p.nombre
             order by valor desc nulls last
             limit 10
            """,
            *params,
        )

        # Distribución por categoría
        por_categoria = await self.conn.fetch(
            f"""
            select coalesce(c.nombre, 'Sin categoría') as categoria,
                   sum(sa.cantidad * sa.costo_promedio) as valor,
                   count(distinct p.id) as productos
              from public.stock_actual sa
              join public.productos p on p.id = sa.producto_id
              left join public.categorias c on c.id = p.categoria_id
             where sa.empresa_id = $1 and p.deleted_at is null
               {almacen_filter}
             group by coalesce(c.nombre, 'Sin categoría')
             order by valor desc nulls last
            """,
            *params,
        )

        return {
            "kpis": {
                "productos_con_stock": int(kpis["productos_con_stock"]),
                "combinaciones": int(kpis["combinaciones"]),
                "unidades_totales": str(kpis["unidades_totales"]),
                "valor_total": str(kpis["valor_total"]),
                "bajo_minimo_count": int(kpis["bajo_minimo_count"]),
            },
            "top_valor": [dict(r) for r in top_valor],
            "por_categoria": [dict(r) for r in por_categoria],
        }

    # -------------------------------------------------------------------
    # 2. Reporte de movimientos (kardex con filtros)
    # -------------------------------------------------------------------
    async def reporte_movimientos(
        self,
        empresa_id: UUID,
        desde: date | None = None,
        hasta: date | None = None,
        producto_id: UUID | None = None,
        almacen_id: UUID | None = None,
        tipo: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        if desde is None:
            desde = (datetime.utcnow() - timedelta(days=30)).date()
        if hasta is None:
            hasta = datetime.utcnow().date()

        where = ["m.empresa_id = $1", "m.created_at::date between $2 and $3"]
        params: list[Any] = [empresa_id, desde, hasta]

        if producto_id:
            params.append(producto_id)
            where.append(f"m.producto_id = ${len(params)}")
        if almacen_id:
            params.append(almacen_id)
            where.append(f"m.almacen_id = ${len(params)}")
        if tipo:
            params.append(tipo)
            where.append(f"m.tipo = ${len(params)}")

        where_sql = " and ".join(where)

        total = await self.conn.fetchval(
            f"select count(*) from public.movimientos_stock m where {where_sql}",
            *params,
        )

        offset = (page - 1) * page_size
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"""
            select m.id, m.created_at, m.tipo, m.cantidad, m.costo_unitario,
                   m.referencia_tipo, m.referencia_id, m.motivo,
                   p.sku, p.nombre as producto_nombre,
                   a.codigo as almacen_codigo, a.nombre as almacen_nombre
              from public.movimientos_stock m
              join public.productos p on p.id = m.producto_id
              join public.almacenes a on a.id = m.almacen_id
             where {where_sql}
             order by m.created_at desc
             limit ${len(params) - 1} offset ${len(params)}
            """,
            *params,
        )

        # Resumen agregado del período
        resumen = await self.conn.fetchrow(
            f"""
            select
              count(*) filter (where m.tipo = 'entrada')          as entradas,
              count(*) filter (where m.tipo = 'salida')           as salidas,
              count(*) filter (where m.tipo = 'ajuste')           as ajustes,
              count(*) filter (where m.tipo like 'transferencia%') as transferencias,
              coalesce(sum(m.cantidad) filter (where m.tipo = 'entrada'), 0) as unidades_entrada,
              coalesce(sum(m.cantidad) filter (where m.tipo = 'salida'),  0) as unidades_salida
              from public.movimientos_stock m
             where {where_sql.split(' limit ')[0]}
            """,
            *params[:-2],  # excluir limit/offset
        )

        return {
            "items": [dict(r) for r in rows],
            "total": int(total),
            "page": page,
            "page_size": page_size,
            "total_pages": (int(total) + page_size - 1) // page_size if page_size else 0,
            "resumen": {
                "entradas": int(resumen["entradas"]),
                "salidas": int(resumen["salidas"]),
                "ajustes": int(resumen["ajustes"]),
                "transferencias": int(resumen["transferencias"]),
                "unidades_entrada": str(resumen["unidades_entrada"]),
                "unidades_salida": str(resumen["unidades_salida"]),
            },
            "rango": {"desde": desde.isoformat(), "hasta": hasta.isoformat()},
        }

    # -------------------------------------------------------------------
    # 3. Bajo stock con sugerencia de reorden
    # -------------------------------------------------------------------
    async def reporte_bajo_stock(self, empresa_id: UUID) -> dict[str, Any]:
        # Cantidad sugerida = (stock_maximo - stock_actual) si stock_maximo definido,
        # de lo contrario (stock_minimo * 2 - stock_actual). Mínimo 0.
        rows = await self.conn.fetch(
            """
            select
              p.id as producto_id,
              p.sku,
              p.nombre,
              p.stock_minimo,
              p.stock_maximo,
              a.id as almacen_id,
              a.codigo as almacen_codigo,
              a.nombre as almacen_nombre,
              sa.cantidad as stock_actual,
              greatest(
                coalesce(p.stock_maximo, p.stock_minimo * 2) - sa.cantidad,
                0
              ) as sugerencia_reorden
              from public.stock_actual sa
              join public.productos p on p.id = sa.producto_id
              join public.almacenes a on a.id = sa.almacen_id
             where sa.empresa_id = $1
               and p.deleted_at is null
               and p.controla_stock = true
               and sa.cantidad <= p.stock_minimo
             order by (sa.cantidad / nullif(p.stock_minimo, 0)) asc nulls first, p.nombre
            """,
            empresa_id,
        )

        items = [dict(r) for r in rows]
        return {
            "items": items,
            "total": len(items),
        }
