"""Repositorio de almacenes."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import ConflictError, NotFoundError


class AlmacenesRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def list(self, empresa_id: UUID, only_active: bool = True) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select id, codigo, nombre, tipo, direccion, ciudad, activo
              from public.almacenes
             where empresa_id = $1 and deleted_at is null
               and ($2 = false or activo = true)
             order by nombre
            """,
            empresa_id,
            only_active,
        )
        return [dict(r) for r in rows]

    async def get(self, almacen_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select id, codigo, nombre, tipo, direccion, ciudad, activo
              from public.almacenes
             where id = $1 and deleted_at is null
            """,
            almacen_id,
        )
        if row is None:
            raise NotFoundError(f"almacén {almacen_id} no encontrado")
        return dict(row)

    async def create(
        self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]
    ) -> dict[str, Any]:
        try:
            row = await self.conn.fetchrow(
                """
                insert into public.almacenes
                    (empresa_id, codigo, nombre, tipo, direccion, ciudad, created_by, updated_by)
                values ($1, $2, $3, $4, $5, $6, $7, $7)
                returning id, codigo, nombre, tipo, direccion, ciudad, activo
                """,
                empresa_id,
                data["codigo"],
                data["nombre"],
                data.get("tipo", "fisico"),
                data.get("direccion"),
                data.get("ciudad"),
                user_id,
            )
        except asyncpg.UniqueViolationError as e:
            raise ConflictError(f"código de almacén ya existe: {data['codigo']}") from e
        return dict(row)
