"""Use cases de clientes."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.modules.inventario.infrastructure.clientes_repo import ClientesRepository
from app.shared.auditoria import registrar_auditoria


class ClientesUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = ClientesRepository(conn)

    async def listar(self, empresa_id: UUID, page: int, page_size: int, search: str | None, tipo: str | None) -> dict[str, Any]:
        items, total = await self.repo.list_paginated(empresa_id, page, page_size, search, tipo)
        return {"items": items, "total": total, "page": page, "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size if page_size else 0}

    async def obtener(self, cliente_id: UUID) -> dict[str, Any]:
        return await self.repo.get(cliente_id)

    async def crear(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        cli = await self.repo.create(empresa_id, user_id, data)
        await registrar_auditoria(self.conn, empresa_id=str(empresa_id), user_id=str(user_id) if user_id else None,
            modulo="inventario", entidad="cliente", entidad_id=str(cli["id"]), accion="crear",
            payload_despues={"nombre": cli["nombre"]})
        return cli

    async def actualizar(self, empresa_id: UUID, user_id: UUID | None, cliente_id: UUID, patch: dict[str, Any]) -> dict[str, Any]:
        antes = await self.repo.get(cliente_id)
        result = await self.repo.update(cliente_id, patch, user_id)
        await registrar_auditoria(self.conn, empresa_id=str(empresa_id), user_id=str(user_id) if user_id else None,
            modulo="inventario", entidad="cliente", entidad_id=str(cliente_id), accion="actualizar",
            payload_antes={"nombre": antes["nombre"]}, payload_despues=patch)
        return result

    async def eliminar(self, empresa_id: UUID, user_id: UUID | None, cliente_id: UUID) -> None:
        await self.repo.soft_delete(cliente_id, user_id)
        await registrar_auditoria(self.conn, empresa_id=str(empresa_id), user_id=str(user_id) if user_id else None,
            modulo="inventario", entidad="cliente", entidad_id=str(cliente_id), accion="eliminar")
