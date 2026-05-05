"""Repositorio de unidades de medida."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import ConflictError, NotFoundError


class UnidadesRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def list(self, empresa_id: UUID, only_active: bool = True) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select id, codigo, nombre, decimales, activo, created_at, updated_at
              from public.unidades_medida
             where empresa_id = $1
               and ($2 = false or activo = true)
             order by codigo
            """,
            empresa_id,
            only_active,
        )
        return [dict(r) for r in rows]

    async def get(self, unidad_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select id, codigo, nombre, decimales, activo, created_at, updated_at
              from public.unidades_medida
             where id = $1
            """,
            unidad_id,
        )
        if row is None:
            raise NotFoundError(f"unidad {unidad_id} no encontrada")
        return dict(row)

    async def create(self, empresa_id: UUID, data: dict[str, Any]) -> dict[str, Any]:
        try:
            row = await self.conn.fetchrow(
                """
                insert into public.unidades_medida (empresa_id, codigo, nombre, decimales)
                values ($1, $2, $3, $4)
                returning id, codigo, nombre, decimales, activo, created_at, updated_at
                """,
                empresa_id,
                data["codigo"],
                data["nombre"],
                data.get("decimales", 0),
            )
        except asyncpg.UniqueViolationError as e:
            raise ConflictError(f"código de unidad ya existe: {data['codigo']}") from e
        return dict(row)

    async def update(self, unidad_id: UUID, patch: dict[str, Any]) -> dict[str, Any]:
        sets: list[str] = []
        params: list[Any] = []
        i = 1
        for k, v in patch.items():
            if k not in {"nombre", "decimales", "activo"}:
                continue
            sets.append(f"{k} = ${i}")
            params.append(v)
            i += 1
        if not sets:
            return await self.get(unidad_id)
        params.append(unidad_id)
        row = await self.conn.fetchrow(
            f"""
            update public.unidades_medida
               set {', '.join(sets)}, updated_at = now()
             where id = ${i}
            returning id, codigo, nombre, decimales, activo, created_at, updated_at
            """,
            *params,
        )
        if row is None:
            raise NotFoundError(f"unidad {unidad_id} no encontrada")
        return dict(row)

    async def desactivar(self, unidad_id: UUID) -> None:
        # Las unidades NO se borran (productos las referencian) — solo se desactivan.
        result = await self.conn.execute(
            "update public.unidades_medida set activo = false, updated_at = now() where id = $1",
            unidad_id,
        )
        if result.split()[-1] == "0":
            raise NotFoundError(f"unidad {unidad_id} no encontrada")
