"""Repositorio de clientes (asyncpg, RLS)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import NotFoundError


class ClientesRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def list_paginated(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        search: str | None,
        tipo: str | None = None,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        clauses = ["empresa_id = $1", "deleted_at is null"]
        params: list[Any] = [empresa_id]

        if tipo:
            params.append(tipo); clauses.append(f"tipo = ${len(params)}")
        if search and search.strip():
            params.append(f"{search.strip().lower()}%")
            clauses.append(
                f"(lower(nombre) like ${len(params)} or lower(email::text) like ${len(params)})"
            )

        where = " and ".join(clauses)
        total = await self.conn.fetchval(f"select count(*) from public.clientes where {where}", *params)
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"select * from public.clientes where {where} order by nombre limit ${len(params)-1} offset ${len(params)}",
            *params,
        )
        return [dict(r) for r in rows], int(total)

    async def get(self, cliente_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            "select * from public.clientes where id = $1 and deleted_at is null", cliente_id
        )
        if not row:
            raise NotFoundError(f"cliente {cliente_id} no encontrado")
        return dict(row)

    async def create(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            insert into public.clientes
              (empresa_id, codigo, nombre, tipo, email, telefono, celular,
               direccion, ciudad, pais, nit, limite_credito, dias_credito, descuento_pct, notas,
               created_by, updated_by)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
            returning *
            """,
            empresa_id, data.get("codigo"), data["nombre"], data.get("tipo","particular"),
            data.get("email"), data.get("telefono"), data.get("celular"),
            data.get("direccion"), data.get("ciudad"), data.get("pais","BO"),
            data.get("nit"), data.get("limite_credito",0), data.get("dias_credito",0),
            data.get("descuento_pct",0), data.get("notas"), user_id,
        )
        return dict(row)

    async def update(self, cliente_id: UUID, patch: dict[str, Any], user_id: UUID | None) -> dict[str, Any]:
        sets, params = [], []
        i = 1
        nullable = {"email","telefono","celular","direccion","ciudad","nit","codigo","notas"}
        for k, v in patch.items():
            if v is None and k not in nullable:
                continue
            sets.append(f"{k} = ${i}"); params.append(v); i += 1
        if not sets:
            return await self.get(cliente_id)
        params.append(user_id); sets.append(f"updated_by = ${i}"); i += 1
        params.append(cliente_id)
        row = await self.conn.fetchrow(
            f"update public.clientes set {', '.join(sets)}, updated_at = now() where id = ${i} and deleted_at is null returning *",
            *params,
        )
        if not row:
            raise NotFoundError(f"cliente {cliente_id} no encontrado")
        return dict(row)

    async def soft_delete(self, cliente_id: UUID, user_id: UUID | None) -> None:
        result = await self.conn.execute(
            "update public.clientes set deleted_at = now(), activo = false, updated_by = $1 where id = $2 and deleted_at is null",
            user_id, cliente_id,
        )
        if result.split()[-1] == "0":
            raise NotFoundError(f"cliente {cliente_id} no encontrado")
