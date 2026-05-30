"""Repositorio de lotes de compra (carga masiva)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import NotFoundError


class LotesRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def listar(
        self, empresa_id: UUID, page: int, page_size: int, search: str | None
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        clauses = ["empresa_id = $1", "deleted_at is null"]
        params: list[Any] = [empresa_id]

        if search and search.strip():
            params.append(f"%{search.strip().lower()}%")
            clauses.append(
                f"(lower(referencia) like ${len(params)} or lower(proveedor_nombre) like ${len(params)})"
            )

        where = " and ".join(clauses)
        total = await self.conn.fetchval(f"select count(*) from public.lotes_compra where {where}", *params)
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"""
            select * from public.lotes_compra
             where {where}
             order by fecha desc, created_at desc
             limit ${len(params)-1} offset ${len(params)}
            """,
            *params,
        )
        return [dict(r) for r in rows], int(total)

    async def get(self, lote_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            "select * from public.lotes_compra where id = $1 and deleted_at is null",
            lote_id,
        )
        if not row:
            raise NotFoundError(f"lote {lote_id} no encontrado")
        return dict(row)

    async def crear(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            insert into public.lotes_compra
              (empresa_id, referencia, proveedor_id, proveedor_nombre, fecha, notas, created_by, updated_by)
            values ($1, $2, $3, $4, $5, $6, $7, $7)
            returning *
            """,
            empresa_id,
            data["referencia"],
            data.get("proveedor_id"),
            data.get("proveedor_nombre"),
            data.get("fecha"),
            data.get("notas"),
            user_id,
        )
        return dict(row)

    async def upsert_items(
        self, empresa_id: UUID, lote_id: UUID, items: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Reemplaza todos los ítems del lote con la nueva lista."""
        async with self.conn.transaction():
            await self.conn.execute(
                "delete from public.lotes_items where lote_id = $1 and empresa_id = $2",
                lote_id, empresa_id,
            )
            result = []
            for item in items:
                row = await self.conn.fetchrow(
                    """
                    insert into public.lotes_items
                      (empresa_id, lote_id, producto_id, sku, nombre, categoria, marca,
                       precio_real, precio_unitario, precio_mecanico, precio_mayor,
                       cantidad, stock_minimo, ubicacion,
                       proveedor, aplicacion, medidas, peso, modelos,
                       anio_desde, anio_hasta, descripcion)
                    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
                    returning *
                    """,
                    empresa_id, lote_id,
                    item.get("producto_id"),
                    item["sku"],
                    item["nombre"],
                    item.get("categoria"),
                    item.get("marca"),
                    item.get("precio_real") or item.get("precioReal"),
                    item.get("precio_unitario") or item.get("precioUnitario"),
                    item.get("precio_mecanico") or item.get("precioMecanico"),
                    item.get("precio_mayor") or item.get("precioMayor"),
                    item.get("cantidad", 0),
                    item.get("stock_minimo") or item.get("stockMin", 0),
                    item.get("ubicacion", ""),
                    item.get("proveedor", ""),
                    item.get("aplicacion", ""),
                    item.get("medidas", ""),
                    item.get("peso"),
                    item.get("modelos", ""),
                    item.get("anio_desde") or item.get("anioDesde"),
                    item.get("anio_hasta") or item.get("anioHasta"),
                    item.get("descripcion", ""),
                )
                result.append(dict(row))

            # Actualizar contador del lote
            await self.conn.execute(
                """
                update public.lotes_compra
                   set productos_count = $1,
                       total_estimado = (
                         select coalesce(sum(coalesce(precio_real,0) * cantidad), 0)
                           from public.lotes_items where lote_id = $2
                       )
                 where id = $2
                """,
                len(items), lote_id,
            )
        return result

    async def get_items(self, lote_id: UUID) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            "select * from public.lotes_items where lote_id = $1 order by created_at",
            lote_id,
        )
        return [dict(r) for r in rows]

    async def reset_to_activo(self, lote_id: UUID) -> None:
        """Permite re-guardar un lote ya confirmado."""
        await self.conn.execute(
            "update public.lotes_compra set estado = 'activo' where id = $1",
            lote_id,
        )

    async def confirmar(self, lote_id: UUID) -> None:
        """Llama a la función SQL confirmar_lote que procesa todos los ítems."""
        await self.conn.execute("select public.confirmar_lote($1)", lote_id)

    async def soft_delete(self, lote_id: UUID, user_id: UUID | None) -> None:
        result = await self.conn.execute(
            """
            update public.lotes_compra
               set deleted_at = now(), updated_by = $1
             where id = $2 and deleted_at is null
            """,
            user_id, lote_id,
        )
        if result.split()[-1] == "0":
            raise NotFoundError(f"lote {lote_id} no encontrado")
