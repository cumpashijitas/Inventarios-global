"""Repositorio de devoluciones."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import NotFoundError


class DevolucionesRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def listar(
        self, empresa_id: UUID, page: int, page_size: int
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        total = await self.conn.fetchval(
            "select count(*) from public.devoluciones where empresa_id = $1",
            empresa_id,
        )
        rows = await self.conn.fetch(
            """
            select d.*,
                   v.numero                  as venta_numero,
                   pd.nombre                 as producto_devuelto_nombre,
                   pd.sku                    as producto_devuelto_sku,
                   pn.nombre                 as producto_nuevo_nombre,
                   pn.sku                    as producto_nuevo_sku
              from public.devoluciones d
              join public.ventas   v  on v.id  = d.venta_id
              join public.productos pd on pd.id = d.producto_devuelto_id
              left join public.productos pn on pn.id = d.producto_nuevo_id
             where d.empresa_id = $1
             order by d.created_at desc
             limit $2 offset $3
            """,
            empresa_id, page_size, offset,
        )
        return [dict(r) for r in rows], int(total)

    async def crear(
        self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]
    ) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            insert into public.devoluciones
              (empresa_id, venta_id, venta_item_id, atendido_por,
               motivo, notas,
               producto_devuelto_id, cantidad_devuelta, monto_devuelto,
               producto_nuevo_id, cantidad_nueva, monto_cobrado,
               diferencia, created_by)
            values
              ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            returning *
            """,
            empresa_id,
            data["venta_id"],
            data.get("venta_item_id"),
            user_id,
            data["motivo"],
            data.get("notas"),
            data["producto_devuelto_id"],
            data["cantidad_devuelta"],
            data["monto_devuelto"],
            data.get("producto_nuevo_id"),
            data.get("cantidad_nueva"),
            data.get("monto_cobrado", 0),
            data["diferencia"],
            user_id,
        )
        return dict(row)

    async def actualizar_caja_id(
        self, devolucion_id: UUID, movimiento_caja_id: UUID
    ) -> None:
        await self.conn.execute(
            "update public.devoluciones set movimiento_caja_id = $1 where id = $2",
            movimiento_caja_id,
            devolucion_id,
        )

    async def get_con_joins(self, devolucion_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select d.*,
                   v.numero   as venta_numero,
                   pd.nombre  as producto_devuelto_nombre,
                   pd.sku     as producto_devuelto_sku,
                   pn.nombre  as producto_nuevo_nombre,
                   pn.sku     as producto_nuevo_sku
              from public.devoluciones d
              join public.ventas    v  on v.id  = d.venta_id
              join public.productos pd on pd.id = d.producto_devuelto_id
              left join public.productos pn on pn.id = d.producto_nuevo_id
             where d.id = $1
            """,
            devolucion_id,
        )
        if not row:
            raise NotFoundError(f"devolución {devolucion_id} no encontrada")
        return dict(row)
