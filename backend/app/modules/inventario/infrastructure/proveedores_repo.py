"""Repositorio de proveedores (asyncpg, RLS)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import NotFoundError


class ProveedoresRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def list_paginated(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        search: str | None,
        only_active: bool = True,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        clauses = ["empresa_id = $1", "deleted_at is null"]
        params: list[Any] = [empresa_id]

        if only_active:
            clauses.append("activo = true")
        if search and search.strip():
            params.append(f"%{search.strip().lower()}%")
            clauses.append(
                f"(lower(razon_social) like ${len(params)} or lower(email) like ${len(params)})"
            )

        where = " and ".join(clauses)
        total = await self.conn.fetchval(f"select count(*) from public.proveedores where {where}", *params)
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"""
            select * from public.proveedores
             where {where}
             order by razon_social
             limit ${len(params)-1} offset ${len(params)}
            """,
            *params,
        )
        return [dict(r) for r in rows], int(total)

    async def get(self, proveedor_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            "select * from public.proveedores where id = $1 and deleted_at is null",
            proveedor_id,
        )
        if not row:
            raise NotFoundError(f"proveedor {proveedor_id} no encontrado")
        return dict(row)

    async def create(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            insert into public.proveedores
              (empresa_id, codigo, razon_social, nombre_contacto, email, telefono, celular,
               direccion, ciudad, pais, nit, categoria, banco, cuenta_bancaria, notas, created_by, updated_by)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
            returning *
            """,
            empresa_id,
            data.get("codigo"),
            data["razon_social"],
            data.get("nombre_contacto"),
            data.get("email"),
            data.get("telefono"),
            data.get("celular"),
            data.get("direccion"),
            data.get("ciudad"),
            data.get("pais", "BO"),
            data.get("nit"),
            data.get("categoria", "general"),
            data.get("banco"),
            data.get("cuenta_bancaria"),
            data.get("notas"),
            user_id,
        )
        return dict(row)

    async def update(self, proveedor_id: UUID, patch: dict[str, Any], user_id: UUID | None) -> dict[str, Any]:
        sets, params = [], []
        i = 1
        nullable = {"email","telefono","celular","direccion","ciudad","nit","codigo","banco","cuenta_bancaria","notas","nombre_contacto"}
        for k, v in patch.items():
            if v is None and k not in nullable:
                continue
            sets.append(f"{k} = ${i}")
            params.append(v)
            i += 1
        if not sets:
            return await self.get(proveedor_id)
        params.append(user_id); sets.append(f"updated_by = ${i}"); i += 1
        params.append(proveedor_id)
        row = await self.conn.fetchrow(
            f"update public.proveedores set {', '.join(sets)}, updated_at = now() where id = ${i} and deleted_at is null returning *",
            *params,
        )
        if not row:
            raise NotFoundError(f"proveedor {proveedor_id} no encontrado")
        return dict(row)

    async def soft_delete(self, proveedor_id: UUID, user_id: UUID | None) -> None:
        result = await self.conn.execute(
            "update public.proveedores set deleted_at = now(), activo = false, updated_by = $1 where id = $2 and deleted_at is null",
            user_id, proveedor_id,
        )
        if result.split()[-1] == "0":
            raise NotFoundError(f"proveedor {proveedor_id} no encontrado")
