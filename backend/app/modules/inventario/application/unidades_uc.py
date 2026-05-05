"""Use cases de unidades de medida."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import DomainError
from app.modules.inventario.infrastructure.unidades_repo import UnidadesRepository
from app.shared.auditoria import registrar_auditoria

_CODIGO_RE = re.compile(r"^[A-Z0-9]{1,10}$")


class UnidadesUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = UnidadesRepository(conn)

    async def listar(self, empresa_id: UUID, only_active: bool = True) -> list[dict[str, Any]]:
        return await self.repo.list(empresa_id, only_active)

    async def crear(
        self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]
    ) -> dict[str, Any]:
        codigo = (data.get("codigo") or "").strip().upper()
        if not _CODIGO_RE.match(codigo):
            raise DomainError("código inválido: alfanumérico mayúsculas, hasta 10 chars")
        if not data.get("nombre", "").strip():
            raise DomainError("nombre requerido")
        decimales = int(data.get("decimales", 0))
        if decimales < 0 or decimales > 6:
            raise DomainError("decimales debe estar entre 0 y 6")
        data["codigo"] = codigo
        data["decimales"] = decimales
        created = await self.repo.create(empresa_id, data)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="unidad",
            entidad_id=str(created["id"]),
            accion="crear",
            payload_despues={k: str(v) for k, v in created.items()},
        )
        return created

    async def actualizar(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        unidad_id: UUID,
        patch: dict[str, Any],
    ) -> dict[str, Any]:
        antes = await self.repo.get(unidad_id)
        actualizada = await self.repo.update(unidad_id, patch)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="unidad",
            entidad_id=str(unidad_id),
            accion="actualizar",
            payload_antes={k: str(v) for k, v in antes.items()},
            payload_despues={k: str(v) for k, v in actualizada.items()},
        )
        return actualizada

    async def desactivar(
        self, empresa_id: UUID, user_id: UUID | None, unidad_id: UUID
    ) -> None:
        antes = await self.repo.get(unidad_id)
        await self.repo.desactivar(unidad_id)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="unidad",
            entidad_id=str(unidad_id),
            accion="desactivar",
            payload_antes={k: str(v) for k, v in antes.items()},
        )
