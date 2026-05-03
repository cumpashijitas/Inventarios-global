"""Use cases de almacenes."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.modules.inventario.domain.entities import Almacen
from app.modules.inventario.infrastructure.almacenes_repo import AlmacenesRepository
from app.shared.auditoria import registrar_auditoria


class AlmacenesUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = AlmacenesRepository(conn)

    async def listar(self, empresa_id: UUID, only_active: bool = True) -> list[dict[str, Any]]:
        return await self.repo.list(empresa_id, only_active)

    async def crear(
        self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]
    ) -> dict[str, Any]:
        # Validar dominio
        Almacen(
            id=UUID(int=0),
            empresa_id=empresa_id,
            codigo=data["codigo"],
            nombre=data["nombre"],
            tipo=data.get("tipo", "fisico"),
        )
        created = await self.repo.create(empresa_id, user_id, data)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="almacen",
            entidad_id=str(created["id"]),
            accion="crear",
            payload_despues={k: str(v) for k, v in created.items()},
        )
        return created
