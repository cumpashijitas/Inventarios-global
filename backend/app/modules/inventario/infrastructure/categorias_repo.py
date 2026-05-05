"""Repositorio de categorías. Soporta jerarquía con parent_id."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import ConflictError, NotFoundError


class CategoriasRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def list(self, empresa_id: UUID, only_active: bool = True) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select id, parent_id, nombre, orden, activo, created_at, updated_at
              from public.categorias
             where empresa_id = $1 and deleted_at is null
               and ($2 = false or activo = true)
             order by orden, nombre
            """,
            empresa_id,
            only_active,
        )
        return [dict(r) for r in rows]

    async def get(self, categoria_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select id, parent_id, nombre, orden, activo, created_at, updated_at
              from public.categorias
             where id = $1 and deleted_at is null
            """,
            categoria_id,
        )
        if row is None:
            raise NotFoundError(f"categoría {categoria_id} no encontrada")
        return dict(row)

    async def create(
        self, empresa_id: UUID, data: dict[str, Any]
    ) -> dict[str, Any]:
        try:
            row = await self.conn.fetchrow(
                """
                insert into public.categorias (empresa_id, parent_id, nombre, orden)
                values ($1, $2, $3, $4)
                returning id, parent_id, nombre, orden, activo, created_at, updated_at
                """,
                empresa_id,
                data.get("parent_id"),
                data["nombre"],
                data.get("orden", 0),
            )
        except asyncpg.UniqueViolationError as e:
            raise ConflictError(f"categoría duplicada: {data['nombre']}") from e
        return dict(row)

    async def update(self, categoria_id: UUID, patch: dict[str, Any]) -> dict[str, Any]:
        sets: list[str] = []
        params: list[Any] = []
        i = 1
        for k, v in patch.items():
            if k not in {"parent_id", "nombre", "orden", "activo"}:
                continue
            sets.append(f"{k} = ${i}")
            params.append(v)
            i += 1
        if not sets:
            return await self.get(categoria_id)
        params.append(categoria_id)
        row = await self.conn.fetchrow(
            f"""
            update public.categorias
               set {', '.join(sets)}, updated_at = now()
             where id = ${i} and deleted_at is null
            returning id, parent_id, nombre, orden, activo, created_at, updated_at
            """,
            *params,
        )
        if row is None:
            raise NotFoundError(f"categoría {categoria_id} no encontrada")
        return dict(row)

    async def soft_delete(self, categoria_id: UUID) -> None:
        # Si tiene productos asociados, desactivar (mantener referencia histórica).
        result = await self.conn.execute(
            """
            update public.categorias
               set deleted_at = now(), activo = false, updated_at = now()
             where id = $1 and deleted_at is null
            """,
            categoria_id,
        )
        if result.split()[-1] == "0":
            raise NotFoundError(f"categoría {categoria_id} no encontrada")
