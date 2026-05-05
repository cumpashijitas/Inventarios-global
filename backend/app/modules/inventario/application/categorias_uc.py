"""Use cases de categorías."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import DomainError
from app.modules.inventario.infrastructure.categorias_repo import CategoriasRepository
from app.shared.auditoria import registrar_auditoria


class CategoriasUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = CategoriasRepository(conn)

    async def listar(self, empresa_id: UUID, only_active: bool = True) -> list[dict[str, Any]]:
        return await self.repo.list(empresa_id, only_active)

    async def crear(
        self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]
    ) -> dict[str, Any]:
        if not data.get("nombre", "").strip():
            raise DomainError("nombre requerido")
        # Validar parent: no auto-referencia, no ciclos triviales
        if data.get("parent_id") and data.get("parent_id") == data.get("id"):
            raise DomainError("una categoría no puede ser su propio padre")
        created = await self.repo.create(empresa_id, data)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="categoria",
            entidad_id=str(created["id"]),
            accion="crear",
            payload_despues={k: str(v) for k, v in created.items()},
        )
        return created

    async def actualizar(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        categoria_id: UUID,
        patch: dict[str, Any],
    ) -> dict[str, Any]:
        antes = await self.repo.get(categoria_id)
        actualizada = await self.repo.update(categoria_id, patch)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="categoria",
            entidad_id=str(categoria_id),
            accion="actualizar",
            payload_antes={k: str(v) for k, v in antes.items()},
            payload_despues={k: str(v) for k, v in actualizada.items()},
        )
        return actualizada

    async def eliminar(
        self, empresa_id: UUID, user_id: UUID | None, categoria_id: UUID
    ) -> None:
        antes = await self.repo.get(categoria_id)
        await self.repo.soft_delete(categoria_id)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="categoria",
            entidad_id=str(categoria_id),
            accion="eliminar",
            payload_antes={k: str(v) for k, v in antes.items()},
        )
