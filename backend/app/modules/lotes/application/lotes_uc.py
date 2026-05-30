"""Use cases de lotes de compra (carga masiva)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.modules.lotes.infrastructure.lotes_repo import LotesRepository
from app.shared.auditoria import registrar_auditoria


class LotesUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = LotesRepository(conn)

    async def listar(
        self, empresa_id: UUID, page: int, page_size: int, search: str | None
    ) -> dict[str, Any]:
        items, total = await self.repo.listar(empresa_id, page, page_size, search)
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        }

    async def obtener(self, lote_id: UUID) -> dict[str, Any]:
        lote = await self.repo.get(lote_id)
        lote["items"] = await self.repo.get_items(lote_id)
        return lote

    async def crear(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        # Buscar nombre del proveedor si se pasó solo el ID
        if data.get("proveedor_id") and not data.get("proveedor_nombre"):
            nombre = await self.conn.fetchval(
                "select razon_social from public.proveedores where id = $1",
                data["proveedor_id"],
            )
            data["proveedor_nombre"] = nombre

        lote = await self.repo.crear(empresa_id, user_id, data)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="compras",
            entidad="lote",
            entidad_id=str(lote["id"]),
            accion="crear",
            payload_despues={"referencia": lote["referencia"]},
        )
        return lote

    async def guardar_items(
        self, empresa_id: UUID, lote_id: UUID, items: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        return await self.repo.upsert_items(empresa_id, lote_id, items)

    async def confirmar(self, empresa_id: UUID, user_id: UUID | None, lote_id: UUID) -> dict[str, Any]:
        await self.repo.confirmar(lote_id)
        lote = await self.repo.get(lote_id)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="compras",
            entidad="lote",
            entidad_id=str(lote_id),
            accion="confirmar",
            payload_despues={"referencia": lote["referencia"], "productos": lote.get("productos_count")},
        )
        return lote

    async def guardar_y_confirmar(
        self, empresa_id: UUID, user_id: UUID | None, lote_id: UUID, items: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Guarda los ítems y procesa el lote en un solo paso. Permite re-guardar."""
        await self.repo.reset_to_activo(lote_id)
        await self.repo.upsert_items(empresa_id, lote_id, items)
        await self.repo.confirmar(lote_id)
        lote = await self.repo.get(lote_id)
        lote["items"] = await self.repo.get_items(lote_id)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="compras",
            entidad="lote",
            entidad_id=str(lote_id),
            accion="guardar",
            payload_despues={"referencia": lote["referencia"], "productos": len(items)},
        )
        return lote

    async def eliminar(self, empresa_id: UUID, user_id: UUID | None, lote_id: UUID) -> None:
        await self.repo.soft_delete(lote_id, user_id)
