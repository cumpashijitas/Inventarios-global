"""Repositorio de productos contra Postgres (asyncpg).

Toda query se ejecuta sobre una conexión que YA tiene `app.current_empresa_id`
seteado (RLS aplica). Por eso los métodos no reciben empresa_id explícito en
el filtro WHERE — RLS lo agrega automáticamente.

Aún así, INSERT y UPDATE incluyen `empresa_id` en columnas porque RLS también
verifica el WITH CHECK.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import ConflictError, NotFoundError


class ProductosRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def list_paginated(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        search: str | None,
        only_active: bool = False,
    ) -> tuple[list[dict[str, Any]], int]:
        offset = (page - 1) * page_size
        where_clauses = ["empresa_id = $1", "deleted_at is null"]
        params: list[Any] = [empresa_id]

        if only_active:
            where_clauses.append("activo = true")

        if search and search.strip():
            params.append(f"%{search.strip().lower()}%")
            where_clauses.append(
                f"(lower(nombre) like ${len(params)} or lower(sku) like ${len(params)})"
            )

        where = " and ".join(where_clauses)

        # Total
        total = await self.conn.fetchval(
            f"select count(*) from public.productos where {where}", *params
        )

        # Página
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"""
            select id, sku, nombre, descripcion, categoria_id, unidad_id,
                   precio_compra, precio_venta, stock_minimo, stock_maximo,
                   controla_stock, activo, imagen_url, created_at, updated_at
              from public.productos
             where {where}
             order by nombre
             limit ${len(params) - 1} offset ${len(params)}
            """,
            *params,
        )
        return [dict(r) for r in rows], int(total)

    async def get(self, producto_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select id, empresa_id, sku, nombre, descripcion, categoria_id, unidad_id,
                   precio_compra, precio_venta, stock_minimo, stock_maximo,
                   controla_stock, activo, imagen_url, metadatos, created_at, updated_at
              from public.productos
             where id = $1 and deleted_at is null
            """,
            producto_id,
        )
        if row is None:
            raise NotFoundError(f"producto {producto_id} no encontrado")
        return dict(row)

    async def create(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            row = await self.conn.fetchrow(
                """
                insert into public.productos
                    (empresa_id, sku, nombre, descripcion, codigo_barras, categoria_id,
                     unidad_id, precio_compra, precio_venta, stock_minimo, stock_maximo,
                     controla_stock, imagen_url, created_by, updated_by)
                values
                    ($1, $2, $3, $4, $5, $6,
                     $7, $8, $9, $10, $11,
                     $12, $13, $14, $14)
                returning id, sku, nombre, descripcion, categoria_id, unidad_id,
                          precio_compra, precio_venta, stock_minimo, stock_maximo,
                          controla_stock, activo, imagen_url, created_at, updated_at
                """,
                empresa_id,
                data["sku"],
                data["nombre"],
                data.get("descripcion"),
                data.get("codigo_barras"),
                data.get("categoria_id"),
                data["unidad_id"],
                data["precio_compra"],
                data["precio_venta"],
                data["stock_minimo"],
                data.get("stock_maximo"),
                data["controla_stock"],
                data.get("imagen_url"),
                user_id,
            )
        except asyncpg.UniqueViolationError as e:
            raise ConflictError(f"SKU ya existe: {data['sku']}") from e
        return dict(row)

    async def update(self, producto_id: UUID, patch: dict[str, Any], user_id: UUID | None) -> dict[str, Any]:
        sets: list[str] = []
        params: list[Any] = []
        i = 1
        for k, v in patch.items():
            if v is None and k not in {"descripcion", "stock_maximo", "imagen_url", "categoria_id"}:
                continue
            sets.append(f"{k} = ${i}")
            params.append(v)
            i += 1
        if not sets:
            return await self.get(producto_id)
        params.append(user_id)
        sets.append(f"updated_by = ${i}")
        i += 1
        params.append(producto_id)

        row = await self.conn.fetchrow(
            f"""
            update public.productos
               set {', '.join(sets)}, updated_at = now()
             where id = ${i} and deleted_at is null
            returning id, sku, nombre, descripcion, categoria_id, unidad_id,
                      precio_compra, precio_venta, stock_minimo, stock_maximo,
                      controla_stock, activo, imagen_url, created_at, updated_at
            """,
            *params,
        )
        if row is None:
            raise NotFoundError(f"producto {producto_id} no encontrado")
        return dict(row)

    async def soft_delete(self, producto_id: UUID, user_id: UUID | None) -> None:
        result = await self.conn.execute(
            """
            update public.productos
               set deleted_at = now(), activo = false, updated_by = $1, updated_at = now()
             where id = $2 and deleted_at is null
            """,
            user_id,
            producto_id,
        )
        # asyncpg devuelve "UPDATE n"
        if result.split()[-1] == "0":
            raise NotFoundError(f"producto {producto_id} no encontrado")
