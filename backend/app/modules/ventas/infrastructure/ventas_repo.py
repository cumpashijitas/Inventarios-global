"""Repositorio de ventas y cotizaciones (asyncpg, RLS)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.database import acquire_tenant_conn
from app.core.exceptions import ConflictError, NotFoundError


class VentasRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    # ------------------------------------------------------------------
    # Ventas
    # ------------------------------------------------------------------
    async def next_numero_venta(self, empresa_id: UUID) -> str:
        """
        Genera el siguiente número de venta correlativo: V-YYYY-NNNN.
        Atómico vía public.numeradores (INSERT ... ON CONFLICT DO UPDATE).

        IMPORTANTE: usa su PROPIA conexión/transacción (acquire_tenant_conn),
        no self.conn. acquire_tenant_conn envuelve TODO el request en una
        sola transacción (lo necesita para que el SET LOCAL de RLS aplique);
        si el numerador se incrementara con self.conn y algo más adelante en
        el mismo request fallara (ej. un choque de otro tipo), la transacción
        entera se revierte — incluido el incremento — y el siguiente intento
        repetiría el mismo número. Con su propia conexión, el incremento
        queda guardado de una vez, como una secuencia real de Postgres.
        """
        async with acquire_tenant_conn(str(empresa_id)) as conn:
            val = await conn.fetchval(
                """
                insert into public.numeradores (empresa_id, tipo, anio, ultimo)
                values ($1, 'venta', extract(year from now())::int, 1)
                on conflict (empresa_id, tipo, anio) do update
                  set ultimo = public.numeradores.ultimo + 1, updated_at = now()
                returning format('V-%s-%s', anio, lpad(ultimo::text, 4, '0'))
                """,
                empresa_id,
            )
        return val

    async def crear_venta(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        async with self.conn.transaction():
            row = await self.conn.fetchrow(
                """
                insert into public.ventas
                  (empresa_id, numero, cliente_id, cliente_nombre, cliente_nit, fecha,
                   estado, metodo_pago, subtotal, descuento_pct, descuento_monto,
                   impuesto_pct, impuesto_monto, total, monto_pagado, cambio,
                   almacen_id, caja_sesion_id, notas, created_by, updated_by)
                values
                  ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20)
                returning *
                """,
                empresa_id,
                data["numero"],
                data.get("cliente_id"),
                data.get("cliente_nombre"),
                data.get("cliente_nit"),
                data["fecha"],
                data.get("estado", "completada"),
                data["metodo_pago"],
                data["subtotal"],
                data.get("descuento_pct", 0),
                data.get("descuento_monto", 0),
                data.get("impuesto_pct", 0),
                data.get("impuesto_monto", 0),
                data["total"],
                data.get("monto_pagado", data["total"]),
                data.get("cambio", 0),
                data.get("almacen_id"),
                data.get("caja_sesion_id"),
                data.get("notas"),
                user_id,
            )
            venta = dict(row)

            # Insertar ítems en un solo round-trip
            if data.get("items"):
                await self.conn.executemany(
                    """
                    insert into public.ventas_items
                      (empresa_id, venta_id, producto_id, sku, nombre,
                       cantidad, precio_unitario, descuento_pct, subtotal, costo_unitario)
                    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    """,
                    [
                        (
                            empresa_id, venta["id"],
                            item.get("producto_id"), item["sku"], item["nombre"],
                            item["cantidad"], item["precio_unitario"],
                            item.get("descuento_pct", 0), item["subtotal"],
                            item.get("costo_unitario", 0),
                        )
                        for item in data["items"]
                    ],
                )

        # Obtener ítems recién insertados (para incluirlos en la respuesta)
        items = await self.conn.fetch(
            "select * from public.ventas_items where venta_id = $1 order by created_at",
            venta["id"],
        )
        venta["items"] = [dict(i) for i in items]

        # Obtener vendedor_nombre para el resultado
        venta["vendedor_nombre"] = await self._get_vendedor_nombre(
            empresa_id, user_id
        ) if user_id else None
        venta["cliente_tipo"] = None
        return venta

    async def _get_vendedor_nombre(self, empresa_id: UUID, user_id: UUID) -> str | None:
        row = await self.conn.fetchrow(
            "select nombre from public.usuarios_empresa where empresa_id = $1 and user_id = $2 limit 1",
            empresa_id, user_id,
        )
        return row["nombre"] if row else None

    async def listar_ventas(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        search: str | None,
        estado: str | None,
        user_id_filter: UUID | None = None,   # None = admin (ve todas)
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        clauses = ["v.empresa_id = $1"]
        params: list[Any] = [empresa_id]

        if user_id_filter:
            params.append(user_id_filter)
            clauses.append(f"v.created_by = ${len(params)}")
        if estado:
            params.append(estado)
            clauses.append(f"v.estado = ${len(params)}")
        if search and search.strip():
            params.append(f"%{search.strip().lower()}%")
            clauses.append(
                f"(lower(v.numero) like ${len(params)} or lower(v.cliente_nombre) like ${len(params)})"
            )

        where = " and ".join(clauses)
        total = await self.conn.fetchval(
            f"select count(*) from public.ventas v where {where}", *params
        )
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"""
            select v.*,
                   ue.nombre  as vendedor_nombre,
                   c.tipo     as cliente_tipo
              from public.ventas v
              left join public.usuarios_empresa ue
                   on ue.user_id = v.created_by and ue.empresa_id = v.empresa_id
              left join public.clientes c on c.id = v.cliente_id
             where {where}
             order by v.fecha desc, v.created_at desc
             limit ${len(params)-1} offset ${len(params)}
            """,
            *params,
        )
        return [dict(r) for r in rows], int(total)

    async def get_venta(self, venta_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select v.*,
                   ue.nombre  as vendedor_nombre,
                   c.tipo     as cliente_tipo
              from public.ventas v
              left join public.usuarios_empresa ue
                   on ue.user_id = v.created_by and ue.empresa_id = v.empresa_id
              left join public.clientes c on c.id = v.cliente_id
             where v.id = $1
            """,
            venta_id,
        )
        if not row:
            raise NotFoundError(f"venta {venta_id} no encontrada")
        venta = dict(row)
        items = await self.conn.fetch(
            "select * from public.ventas_items where venta_id = $1 order by created_at",
            venta_id,
        )
        venta["items"] = [dict(i) for i in items]
        return venta

    async def anular_venta(self, venta_id: UUID, motivo: str, user_id: UUID | None) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            update public.ventas
               set estado = 'anulada', anulada_en = now(), anulada_por = $1,
                   motivo_anulacion = $2, updated_by = $1
             where id = $3 and estado != 'anulada'
            returning *
            """,
            user_id, motivo, venta_id,
        )
        if not row:
            raise NotFoundError(f"venta {venta_id} no encontrada o ya está anulada")
        result = dict(row)
        result["vendedor_nombre"] = None
        result["cliente_tipo"] = None
        return result

    # ------------------------------------------------------------------
    # Cotizaciones
    # ------------------------------------------------------------------
    async def next_numero_cotizacion(self, empresa_id: UUID) -> str:
        """Atómico y con conexión propia — ver next_numero_venta."""
        async with acquire_tenant_conn(str(empresa_id)) as conn:
            val = await conn.fetchval(
                """
                insert into public.numeradores (empresa_id, tipo, anio, ultimo)
                values ($1, 'cotizacion', extract(year from now())::int, 1)
                on conflict (empresa_id, tipo, anio) do update
                  set ultimo = public.numeradores.ultimo + 1, updated_at = now()
                returning format('COT-%s-%s', anio, lpad(ultimo::text, 4, '0'))
                """,
                empresa_id,
            )
        return val

    async def crear_cotizacion(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        async with self.conn.transaction():
            row = await self.conn.fetchrow(
                """
                insert into public.cotizaciones
                  (empresa_id, numero, cliente_id, cliente_nombre, fecha,
                   vigencia_dias, estado, subtotal, descuento_monto, total, notas, created_by, updated_by)
                values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
                returning *
                """,
                empresa_id,
                data["numero"],
                data.get("cliente_id"),
                data.get("cliente_nombre"),
                data["fecha"],
                data.get("vigencia_dias", 15),
                data.get("estado", "pendiente"),
                data["subtotal"],
                data.get("descuento_monto", 0),
                data["total"],
                data.get("notas"),
                user_id,
            )
            cot = dict(row)
            if data.get("items"):
                await self.conn.executemany(
                    """
                    insert into public.cotizaciones_items
                      (empresa_id, cotizacion_id, producto_id, sku, nombre,
                       cantidad, precio_unitario, descuento_pct, subtotal)
                    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                    """,
                    [
                        (
                            empresa_id, cot["id"],
                            item.get("producto_id"), item["sku"], item["nombre"],
                            item["cantidad"], item["precio_unitario"],
                            item.get("descuento_pct", 0), item["subtotal"],
                        )
                        for item in data["items"]
                    ],
                )
        # Obtener ítems recién insertados
        items_cot = await self.conn.fetch(
            "select * from public.cotizaciones_items where cotizacion_id = $1",
            cot["id"],
        )
        cot["items"] = [dict(i) for i in items_cot]

        cot["vendedor_nombre"] = await self._get_vendedor_nombre(
            empresa_id, user_id
        ) if user_id else None
        cot["cliente_tipo"] = None
        return cot

    async def listar_cotizaciones(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        estado: str | None = None,
        search: str | None = None,
    ) -> tuple[list[dict], int]:
        # ── Auto-vencer cotizaciones pendientes que superaron su fecha límite ──
        await self.conn.execute(
            """
            UPDATE public.cotizaciones
               SET estado = 'vencida'
             WHERE empresa_id = $1
               AND estado    = 'pendiente'
               AND deleted_at IS NULL
               AND (fecha + (vigencia_dias || ' days')::interval)::date < CURRENT_DATE
            """,
            empresa_id,
        )

        offset = (page - 1) * page_size
        clauses = ["c.empresa_id = $1", "c.deleted_at is null"]
        params: list[Any] = [empresa_id]

        if estado:
            params.append(estado)
            clauses.append(f"c.estado = ${len(params)}")
        if search and search.strip():
            params.append(f"%{search.strip().lower()}%")
            clauses.append(
                f"(lower(c.numero) like ${len(params)} or lower(c.cliente_nombre) like ${len(params)})"
            )

        where = " and ".join(clauses)
        total = await self.conn.fetchval(
            f"select count(*) from public.cotizaciones c where {where}", *params
        )
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"""
            select c.*,
                   ue.nombre  as vendedor_nombre,
                   cl.tipo    as cliente_tipo
              from public.cotizaciones c
              left join public.usuarios_empresa ue
                   on ue.user_id = c.created_by and ue.empresa_id = c.empresa_id
              left join public.clientes cl on cl.id = c.cliente_id
             where {where}
             order by c.fecha desc, c.created_at desc
             limit ${len(params)-1} offset ${len(params)}
            """,
            *params,
        )
        return [dict(r) for r in rows], int(total)

    async def get_cotizacion(self, cotizacion_id: UUID) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            select c.*,
                   ue.nombre  as vendedor_nombre,
                   cl.tipo    as cliente_tipo
              from public.cotizaciones c
              left join public.usuarios_empresa ue
                   on ue.user_id = c.created_by and ue.empresa_id = c.empresa_id
              left join public.clientes cl on cl.id = c.cliente_id
             where c.id = $1 and c.deleted_at is null
            """,
            cotizacion_id,
        )
        if not row:
            raise NotFoundError(f"cotización {cotizacion_id} no encontrada")
        cot = dict(row)
        items = await self.conn.fetch(
            "select * from public.cotizaciones_items where cotizacion_id = $1",
            cotizacion_id,
        )
        cot["items"] = [dict(i) for i in items]
        return cot

    async def actualizar_estado_cotizacion(self, cotizacion_id: UUID, estado: str, user_id: UUID | None) -> dict[str, Any]:
        row = await self.conn.fetchrow(
            """
            update public.cotizaciones
               set estado = $1, updated_by = $2
             where id = $3 and deleted_at is null
            returning *
            """,
            estado, user_id, cotizacion_id,
        )
        if not row:
            raise NotFoundError(f"cotización {cotizacion_id} no encontrada")
        result = dict(row)
        result["vendedor_nombre"] = None
        result["cliente_tipo"] = None
        return result
