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
        where_clauses = ["p.empresa_id = $1", "p.deleted_at is null"]
        params: list[Any] = [empresa_id]

        if only_active:
            where_clauses.append("p.activo = true")

        if search and search.strip():
            for token in search.strip().lower().split():
                params.append(f"%{token}%")
                n = len(params)
                # Solo busca en identificadores del producto, NO en campos de
                # compatibilidad (modelos, aplicacion, motor, etc.) porque esos
                # campos referencian otros códigos y generan falsos positivos.
                where_clauses.append(
                    f"(lower(p.nombre) like ${n}"
                    f" or lower(p.sku) like ${n}"
                    f" or lower(coalesce(p.codigo_universal,'')) like ${n}"
                    f" or lower(coalesce(p.marca,'')) like ${n}"
                    f" or lower(coalesce(p.procedencia,'')) like ${n})"
                )

        where = " and ".join(where_clauses)

        # Total
        total = await self.conn.fetchval(
            f"select count(*) from public.productos p where {where}", *params
        )

        # Página — incluye stock_total sumado de todos los almacenes
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"""
            select p.id, p.sku, p.nombre, p.descripcion, p.categoria_id, p.unidad_id,
                   p.precio_compra, p.precio_venta, p.precio_mecanico, p.precio_mayor,
                   p.stock_minimo, p.stock_maximo, p.controla_stock, p.activo,
                   p.imagen_url, p.marca, p.proveedor_id, p.aplicacion, p.medidas,
                   p.peso, p.modelos, p.anio_desde, p.anio_hasta, p.ubicacion,
                   p.codigo_universal, p.procedencia, p.costo_caja, p.industria, p.motor, p.precio_real,
                   p.created_at, p.updated_at,
                   coalesce(s.stock_total, 0) as stock_total
              from public.productos p
              left join (
                select producto_id, sum(cantidad) as stock_total
                  from public.stock_actual
                 group by producto_id
              ) s on s.producto_id = p.id
             where {where}
             order by p.nombre
             limit ${len(params) - 1} offset ${len(params)}
            """,
            *params,
        )
        return [dict(r) for r in rows], int(total)

    async def get(self, producto_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select id, empresa_id, sku, nombre, descripcion, categoria_id, unidad_id,
                   precio_compra, precio_venta, precio_mecanico, precio_mayor,
                   stock_minimo, stock_maximo, controla_stock, activo,
                   imagen_url, metadatos, marca, proveedor_id, aplicacion, medidas,
                   peso, modelos, anio_desde, anio_hasta, ubicacion,
                   codigo_universal, procedencia, costo_caja, industria, motor, precio_real,
                   created_at, updated_at
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
                     unidad_id, precio_compra, precio_venta, precio_mecanico, precio_mayor,
                     stock_minimo, stock_maximo, controla_stock, imagen_url,
                     marca, proveedor_id, aplicacion, medidas, peso, modelos,
                     anio_desde, anio_hasta, ubicacion,
                     codigo_universal, procedencia, costo_caja, industria, motor, precio_real,
                     created_by, updated_by)
                values
                    ($1,$2,$3,$4,$5,$6,
                     $7,$8,$9,$10,$11,
                     $12,$13,$14,$15,
                     $16,$17,$18,$19,$20,$21,
                     $22,$23,$24,
                     $25,$26,$27,$28,$29,$30,
                     $31,$31)
                returning id, sku, nombre, descripcion, categoria_id, unidad_id,
                          precio_compra, precio_venta, precio_mecanico, precio_mayor,
                          stock_minimo, stock_maximo, controla_stock, activo,
                          imagen_url, marca, proveedor_id, aplicacion, medidas,
                          peso, modelos, anio_desde, anio_hasta, ubicacion,
                          codigo_universal, procedencia, costo_caja, industria, motor, precio_real,
                          created_at, updated_at
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
                data.get("precio_mecanico"),
                data.get("precio_mayor"),
                data["stock_minimo"],
                data.get("stock_maximo"),
                data["controla_stock"],
                data.get("imagen_url"),
                data.get("marca"),
                data.get("proveedor_id"),
                data.get("aplicacion"),
                data.get("medidas"),
                data.get("peso"),
                data.get("modelos"),
                data.get("anio_desde"),
                data.get("anio_hasta"),
                data.get("ubicacion"),
                data.get("codigo_universal"),
                data.get("procedencia"),
                data.get("costo_caja"),
                data.get("industria"),
                data.get("motor"),
                data.get("precio_real"),
                user_id,
            )
        except asyncpg.UniqueViolationError as e:
            raise ConflictError(f"SKU ya existe: {data['sku']}") from e
        return dict(row)

    async def update(self, producto_id: UUID, patch: dict[str, Any], user_id: UUID | None) -> dict[str, Any]:
        sets: list[str] = []
        params: list[Any] = []
        i = 1
        _nullable_cols = {
            "descripcion", "stock_maximo", "imagen_url", "categoria_id",
            "precio_mecanico", "precio_mayor", "marca", "proveedor_id",
            "aplicacion", "medidas", "peso", "modelos", "anio_desde",
            "anio_hasta", "ubicacion",
            "codigo_universal", "procedencia", "costo_caja", "industria", "motor", "precio_real",
        }
        for k, v in patch.items():
            if v is None and k not in _nullable_cols:
                continue
            sets.append(f"{k} = ${i}")
            params.append(v)
            i += 1
        # always-nullable columns (patch can set them to null explicitly)
        _nullable = {"descripcion", "stock_maximo", "imagen_url", "categoria_id",
                     "precio_mecanico", "precio_mayor", "marca", "proveedor_id",
                     "aplicacion", "medidas", "peso", "modelos", "anio_desde",
                     "anio_hasta", "ubicacion",
                     "codigo_universal", "procedencia", "costo_caja", "industria", "motor", "precio_real"}
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
                      precio_compra, precio_venta, precio_mecanico, precio_mayor,
                      stock_minimo, stock_maximo, controla_stock, activo,
                      imagen_url, marca, proveedor_id, aplicacion, medidas,
                      peso, modelos, anio_desde, anio_hasta, ubicacion,
                      codigo_universal, procedencia, costo_caja, industria, motor, precio_real,
                      created_at, updated_at
            """,
            *params,
        )
        if row is None:
            raise NotFoundError(f"producto {producto_id} no encontrado")
        return dict(row)

    async def list_stock_bajo(self, empresa_id: UUID) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select p.id, p.sku, p.nombre, p.marca,
                   c.nombre              as categoria,
                   pv.razon_social       as proveedor,
                   coalesce(s.stock_total, 0)              as stock_actual,
                   p.stock_minimo,
                   p.stock_minimo - coalesce(s.stock_total, 0) as diferencia
              from public.productos p
              left join public.categorias  c  on c.id  = p.categoria_id
              left join public.proveedores pv on pv.id = p.proveedor_id
              left join (
                select producto_id, sum(cantidad) as stock_total
                  from public.stock_actual
                 group by producto_id
              ) s on s.producto_id = p.id
             where p.empresa_id = $1
               and p.deleted_at is null
               and p.activo = true
               and p.controla_stock = true
               and coalesce(s.stock_total, 0) < p.stock_minimo
             order by (p.stock_minimo - coalesce(s.stock_total, 0)) desc
            """,
            empresa_id,
        )
        return [dict(r) for r in rows]

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
