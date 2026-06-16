"""Repositorio de stock + movimientos.

Toda mutación pasa por la función SQL `registrar_movimiento_stock` para
garantizar atomicidad ledger ↔ snapshot ↔ validación de stock negativo.
NO hacer UPDATE directo a stock_actual desde Python.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import StockInsuficienteError


class StockRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def stock_actual(
        self, producto_id: UUID, almacen_id: UUID | None = None
    ) -> list[dict[str, Any]]:
        if almacen_id is not None:
            rows = await self.conn.fetch(
                """
                select producto_id, almacen_id, cantidad, costo_promedio, updated_at
                  from public.stock_actual
                 where producto_id = $1 and almacen_id = $2
                """,
                producto_id,
                almacen_id,
            )
        else:
            rows = await self.conn.fetch(
                """
                select producto_id, almacen_id, cantidad, costo_promedio, updated_at
                  from public.stock_actual
                 where producto_id = $1
                """,
                producto_id,
            )
        return [dict(r) for r in rows]

    async def registrar_movimiento(
        self,
        producto_id: UUID,
        almacen_id: UUID,
        tipo: str,
        cantidad,
        costo_unitario=0,
        referencia_tipo: str | None = None,
        referencia_id: UUID | None = None,
        motivo: str | None = None,
    ) -> UUID:
        try:
            mov_id = await self.conn.fetchval(
                """
                select public.registrar_movimiento_stock(
                    $1, $2, $3, $4::numeric, $5::numeric, $6, $7, $8
                )
                """,
                producto_id,
                almacen_id,
                tipo,
                cantidad,
                costo_unitario,
                referencia_tipo,
                referencia_id,
                motivo,
            )
        except asyncpg.RaiseError as e:
            msg = str(e)
            if "stock insuficiente" in msg.lower():
                # Extraer cantidad disponible si está en el mensaje
                raise StockInsuficienteError(str(producto_id), str(almacen_id), 0.0) from e
            raise
        return mov_id

    async def registrar_movimientos_batch(
        self,
        items: list[dict],
        almacen_id: UUID,
        referencia_tipo: str,
        referencia_id: UUID,
        motivo_prefix: str,
        tipo: str = "salida",
    ) -> list[UUID]:
        """Registra N movimientos de stock en un solo round-trip usando la función batch."""
        if not items:
            return []
        filtered = [i for i in items if i.get("producto_id")]
        if not filtered:
            return []
        try:
            ids = await self.conn.fetchval(
                """
                SELECT public.registrar_movimientos_stock_batch(
                    $1::uuid[], $2::uuid[], $3::text[], $4::numeric[],
                    $5::numeric[], $6::text[], $7::uuid[], $8::text[]
                )
                """,
                [UUID(str(i["producto_id"])) for i in filtered],
                [almacen_id] * len(filtered),
                [tipo] * len(filtered),
                [float(i["cantidad"]) for i in filtered],
                [float(i.get("costo_unitario", 0)) for i in filtered],
                [referencia_tipo] * len(filtered),
                [referencia_id] * len(filtered),
                [motivo_prefix] * len(filtered),
            )
        except Exception as e:
            msg = str(e)
            if "stock insuficiente" in msg.lower():
                raise StockInsuficienteError("batch", str(almacen_id), 0.0) from e
            raise
        return ids or []

    async def listar_movimientos(
        self,
        producto_id: UUID | None,
        almacen_id: UUID | None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        clauses = []
        params: list[Any] = []
        i = 1
        if producto_id:
            clauses.append(f"producto_id = ${i}")
            params.append(producto_id)
            i += 1
        if almacen_id:
            clauses.append(f"almacen_id = ${i}")
            params.append(almacen_id)
            i += 1
        where = ("where " + " and ".join(clauses)) if clauses else ""
        params.append(limit)

        rows = await self.conn.fetch(
            f"""
            select id, producto_id, almacen_id, tipo, cantidad, costo_unitario,
                   referencia_tipo, referencia_id, motivo, created_at
              from public.movimientos_stock
             {where}
             order by created_at desc
             limit ${i}
            """,
            *params,
        )
        return [dict(r) for r in rows]
