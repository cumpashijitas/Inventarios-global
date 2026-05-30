"""Use cases de proveedores."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.modules.inventario.infrastructure.proveedores_repo import ProveedoresRepository
from app.shared.auditoria import registrar_auditoria


class ProveedoresUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = ProveedoresRepository(conn)

    async def listar(self, empresa_id: UUID, page: int, page_size: int, search: str | None, only_active: bool) -> dict[str, Any]:
        items, total = await self.repo.list_paginated(empresa_id, page, page_size, search, only_active)
        return {"items": items, "total": total, "page": page, "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size if page_size else 0}

    async def obtener(self, proveedor_id: UUID) -> dict[str, Any]:
        return await self.repo.get(proveedor_id)

    async def crear(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        prov = await self.repo.create(empresa_id, user_id, data)
        await registrar_auditoria(self.conn, empresa_id=str(empresa_id), user_id=str(user_id) if user_id else None,
            modulo="inventario", entidad="proveedor", entidad_id=str(prov["id"]), accion="crear",
            payload_despues={"razon_social": prov["razon_social"]})
        return prov

    async def actualizar(self, empresa_id: UUID, user_id: UUID | None, proveedor_id: UUID, patch: dict[str, Any]) -> dict[str, Any]:
        antes = await self.repo.get(proveedor_id)
        result = await self.repo.update(proveedor_id, patch, user_id)
        await registrar_auditoria(self.conn, empresa_id=str(empresa_id), user_id=str(user_id) if user_id else None,
            modulo="inventario", entidad="proveedor", entidad_id=str(proveedor_id), accion="actualizar",
            payload_antes={"razon_social": antes["razon_social"]}, payload_despues=patch)
        return result

    async def eliminar(self, empresa_id: UUID, user_id: UUID | None, proveedor_id: UUID) -> None:
        await self.repo.soft_delete(proveedor_id, user_id)
        await registrar_auditoria(self.conn, empresa_id=str(empresa_id), user_id=str(user_id) if user_id else None,
            modulo="inventario", entidad="proveedor", entidad_id=str(proveedor_id), accion="eliminar")
