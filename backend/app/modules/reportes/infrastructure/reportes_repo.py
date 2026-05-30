"""Repositorio de reportes (queries agregadas, solo lectura)."""
from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

import asyncpg


class ReportesRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def resumen_ventas(self, empresa_id: UUID, desde: date, hasta: date) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select
              coalesce(sum(total), 0)                          as ingresos_totales,
              coalesce(sum(total - coalesce(
                (select sum(vi.costo_unitario * vi.cantidad)
                   from public.ventas_items vi where vi.venta_id = v.id), 0
              )), 0)                                           as ganancia_bruta,
              count(*)                                         as transacciones,
              coalesce(avg(total), 0)                          as ticket_promedio
            from public.ventas v
            where empresa_id = $1
              and fecha between $2 and $3
              and estado = 'completada'
            """,
            empresa_id, desde, hasta,
        )
        data = dict(row) if row else {}
        # Calcular costo total
        costo = await self.conn.fetchval(
            """
            select coalesce(sum(vi.costo_unitario * vi.cantidad), 0)
              from public.ventas_items vi
              join public.ventas v on v.id = vi.venta_id
             where v.empresa_id = $1
               and v.fecha between $2 and $3
               and v.estado = 'completada'
            """,
            empresa_id, desde, hasta,
        )
        data["costo_total"] = float(costo or 0)
        data["ingresos_totales"] = float(data.get("ingresos_totales", 0))
        data["ganancia_bruta"] = data["ingresos_totales"] - data["costo_total"]
        data["margen"] = (
            data["ganancia_bruta"] / data["ingresos_totales"] * 100
            if data["ingresos_totales"] > 0 else 0
        )
        data["transacciones"] = int(data.get("transacciones", 0))
        data["ticket_promedio"] = float(data.get("ticket_promedio", 0))
        return data

    async def resumen_inventario(self, empresa_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select
              count(distinct p.id)                                          as total_productos,
              coalesce(sum(sa.cantidad * p.precio_compra), 0)               as valor_total,
              count(distinct case when sa.cantidad <= p.stock_minimo
                                   and sa.cantidad > 0 then p.id end)      as stock_bajo,
              count(distinct case when sa.cantidad = 0 then p.id end)      as sin_stock,
              count(distinct p.categoria_id)                               as categorias
            from public.productos p
            left join public.stock_actual sa
              on sa.producto_id = p.id and sa.empresa_id = p.empresa_id
            where p.empresa_id = $1 and p.deleted_at is null and p.activo = true
            """,
            empresa_id,
        )
        data = dict(row) if row else {}
        prov_count = await self.conn.fetchval(
            "select count(*) from public.proveedores where empresa_id = $1 and deleted_at is null",
            empresa_id,
        )
        data["proveedores"] = int(prov_count or 0)
        return {k: (int(v) if isinstance(v, int) else float(v or 0)) for k, v in data.items()}

    async def movimientos(
        self, empresa_id: UUID, desde: date, hasta: date, limit: int = 200
    ) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select ms.id, ms.tipo, ms.cantidad, ms.costo_unitario,
                   ms.referencia_tipo, ms.referencia_id, ms.motivo,
                   ms.created_at,
                   p.sku, p.nombre as producto_nombre,
                   a.nombre as almacen_nombre
              from public.movimientos_stock ms
              join public.productos p on p.id = ms.producto_id
              join public.almacenes a on a.id = ms.almacen_id
             where ms.empresa_id = $1
               and ms.created_at::date between $2 and $3
             order by ms.created_at desc
             limit $4
            """,
            empresa_id, desde, hasta, limit,
        )
        return [dict(r) for r in rows]

    async def movimientos_paginados(
        self, empresa_id: UUID, desde: date, hasta: date, page: int, page_size: int
    ) -> tuple[list[dict[str, Any]], int]:
        offset = (page - 1) * page_size
        total = await self.conn.fetchval(
            """
            select count(*)
              from public.movimientos_stock ms
             where ms.empresa_id = $1
               and ms.created_at::date between $2 and $3
            """,
            empresa_id, desde, hasta,
        )
        rows = await self.conn.fetch(
            """
            select ms.id, ms.tipo, ms.cantidad, ms.costo_unitario,
                   ms.referencia_tipo, ms.motivo, ms.created_at,
                   p.sku, p.nombre as producto_nombre,
                   a.nombre as almacen_nombre
              from public.movimientos_stock ms
              join public.productos p on p.id = ms.producto_id
              join public.almacenes a on a.id = ms.almacen_id
             where ms.empresa_id = $1
               and ms.created_at::date between $2 and $3
             order by ms.created_at desc
             limit $4 offset $5
            """,
            empresa_id, desde, hasta, page_size, offset,
        )
        return [dict(r) for r in rows], int(total)

    async def top_productos(
        self, empresa_id: UUID, desde: date, hasta: date, limit: int = 10
    ) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select vi.sku, vi.nombre,
                   sum(vi.cantidad) as cantidad_vendida,
                   sum(vi.subtotal) as total_vendido
              from public.ventas_items vi
              join public.ventas v on v.id = vi.venta_id
             where v.empresa_id = $1
               and v.fecha between $2 and $3
               and v.estado = 'completada'
             group by vi.sku, vi.nombre
             order by total_vendido desc
             limit $4
            """,
            empresa_id, desde, hasta, limit,
        )
        return [dict(r) for r in rows]

    async def ventas_por_dia(self, empresa_id: UUID, desde: date, hasta: date) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select fecha, count(*) as transacciones, coalesce(sum(total), 0) as total
              from public.ventas
             where empresa_id = $1 and fecha between $2 and $3 and estado = 'completada'
             group by fecha
             order by fecha
            """,
            empresa_id, desde, hasta,
        )
        return [dict(r) for r in rows]
