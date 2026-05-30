"""Repositorio de caja (asyncpg, RLS)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import ConflictError, NotFoundError


class CajaRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def sesion_abierta(self, empresa_id: UUID) -> dict[str, Any] | None:
        row = await self.conn.fetchrow(
            """
            select * from public.caja_sesiones
             where empresa_id = $1 and estado = 'abierta'
             order by abierta_en desc
             limit 1
            """,
            empresa_id,
        )
        return dict(row) if row else None

    async def abrir_sesion(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        existente = await self.sesion_abierta(empresa_id)
        if existente:
            raise ConflictError(f"ya existe una caja abierta: {existente['codigo']}")

        row = await self.conn.fetchrow(
            """
            insert into public.caja_sesiones
              (empresa_id, codigo, cajero_id, cajero_nombre, estado, saldo_inicial, almacen_id)
            values ($1, $2, $3, $4, 'abierta', $5, $6)
            returning *
            """,
            empresa_id,
            data.get("codigo", "CAJA-001"),
            user_id,
            data.get("cajero_nombre"),
            data.get("saldo_inicial", 0),
            data.get("almacen_id"),
        )
        sesion = dict(row)

        # Registrar movimiento de apertura
        await self.conn.execute(
            """
            insert into public.caja_movimientos
              (empresa_id, sesion_id, tipo, referencia, monto, saldo_acumulado, usuario_id)
            values ($1, $2, 'apertura', 'Apertura de caja', $3, $3, $4)
            """,
            empresa_id, sesion["id"],
            data.get("saldo_inicial", 0),
            user_id,
        )
        return sesion

    async def cerrar_sesion(
        self, empresa_id: UUID, user_id: UUID | None, sesion_id: UUID, saldo_final: float, notas: str | None
    ) -> dict[str, Any]:
        # Calcular saldo esperado
        saldo_esperado = await self.conn.fetchval(
            "select sum(monto) from public.caja_movimientos where sesion_id = $1",
            sesion_id,
        )
        diferencia = float(saldo_final) - float(saldo_esperado or 0)

        row = await self.conn.fetchrow(
            """
            update public.caja_sesiones
               set estado = 'cerrada', cerrada_en = now(),
                   saldo_final = $1, saldo_esperado = $2, diferencia = $3, notas_cierre = $4
             where id = $5 and empresa_id = $6 and estado = 'abierta'
            returning *
            """,
            saldo_final, float(saldo_esperado or 0), diferencia, notas, sesion_id, empresa_id,
        )
        if not row:
            raise NotFoundError(f"sesión {sesion_id} no encontrada o ya está cerrada")

        # Registrar movimiento de cierre
        await self.conn.execute(
            """
            insert into public.caja_movimientos
              (empresa_id, sesion_id, tipo, referencia, monto, saldo_acumulado, usuario_id, notas)
            values ($1, $2, 'cierre', 'Cierre de caja', 0, $3, $4, $5)
            """,
            empresa_id, sesion_id, saldo_final, user_id, notas,
        )
        return dict(row)

    async def registrar_movimiento(
        self, empresa_id: UUID, user_id: UUID | None, sesion_id: UUID, data: dict[str, Any]
    ) -> dict[str, Any]:
        # Obtener saldo acumulado actual
        saldo_actual = await self.conn.fetchval(
            "select sum(monto) from public.caja_movimientos where sesion_id = $1",
            sesion_id,
        ) or 0
        # ventas e ingresos son dinero que entra (positivo); retiros son dinero que sale (negativo)
        if data["tipo"] in ("ingreso", "venta"):
            monto = abs(float(data["monto"]))
        else:  # retiro
            monto = -abs(float(data["monto"]))
        nuevo_saldo = float(saldo_actual) + monto

        row = await self.conn.fetchrow(
            """
            insert into public.caja_movimientos
              (empresa_id, sesion_id, tipo, referencia, metodo_pago, monto, saldo_acumulado, usuario_id, notas)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            returning *
            """,
            empresa_id, sesion_id,
            data["tipo"],
            data.get("referencia", data.get("concepto", "")),
            data.get("metodo_pago"),
            monto, nuevo_saldo, user_id,
            data.get("notas") or data.get("concepto"),
        )
        return dict(row)

    async def listar_movimientos(self, sesion_id: UUID) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select * from public.caja_movimientos
             where sesion_id = $1
             order by created_at
            """,
            sesion_id,
        )
        return [dict(r) for r in rows]

    async def resumen_metodos_pago(self, sesion_id: UUID) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select metodo_pago, sum(monto) as total, count(*) as transacciones
              from public.caja_movimientos
             where sesion_id = $1 and tipo = 'venta'
             group by metodo_pago
            """,
            sesion_id,
        )
        return [dict(r) for r in rows]

    # ------------------------------------------------------------------
    # Historial de sesiones
    # ------------------------------------------------------------------
    async def listar_sesiones(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        desde: Any = None,
        hasta: Any = None,
    ) -> tuple[list[dict[str, Any]], int]:
        offset = (page - 1) * page_size
        clauses = ["s.empresa_id = $1"]
        params: list[Any] = [empresa_id]

        if desde:
            params.append(desde)
            clauses.append(f"s.abierta_en::date >= ${len(params)}")
        if hasta:
            params.append(hasta)
            clauses.append(f"s.abierta_en::date <= ${len(params)}")

        where = " and ".join(clauses)
        total = await self.conn.fetchval(
            f"select count(*) from public.caja_sesiones s where {where}", *params
        )
        params.extend([page_size, offset])
        rows = await self.conn.fetch(
            f"""
            select
              s.*,
              coalesce(sum(case when m.tipo in ('ingreso','venta') then m.monto else 0 end), 0) as total_ingresos,
              coalesce(sum(case when m.tipo = 'retiro' then abs(m.monto) else 0 end), 0)        as total_retiros,
              count(case when m.tipo = 'venta' then 1 end)                                       as num_ventas
            from public.caja_sesiones s
            left join public.caja_movimientos m on m.sesion_id = s.id
            where {where}
            group by s.id
            order by s.abierta_en desc
            limit ${len(params)-1} offset ${len(params)}
            """,
            *params,
        )
        return [dict(r) for r in rows], int(total)

    async def get_sesion_detalle(
        self, empresa_id: UUID, sesion_id: UUID
    ) -> dict[str, Any] | None:
        row = await self.conn.fetchrow(
            """
            select
              s.*,
              coalesce(sum(case when m.tipo in ('ingreso','venta') then m.monto else 0 end), 0) as total_ingresos,
              coalesce(sum(case when m.tipo = 'retiro' then abs(m.monto) else 0 end), 0)        as total_retiros,
              count(case when m.tipo = 'venta' then 1 end)                                       as num_ventas
            from public.caja_sesiones s
            left join public.caja_movimientos m on m.sesion_id = s.id
            where s.id = $1 and s.empresa_id = $2
            group by s.id
            """,
            sesion_id, empresa_id,
        )
        if not row:
            return None
        sesion = dict(row)
        movimientos = await self.listar_movimientos(sesion_id)
        metodos = await self.resumen_metodos_pago(sesion_id)
        sesion["movimientos"] = movimientos
        sesion["metodos_pago"] = metodos
        # saldo_actual: para sesiones abiertas se recalcula; para cerradas es saldo_esperado
        if sesion.get("estado") == "abierta":
            sesion["saldo_actual"] = sum(m["monto"] for m in movimientos) if movimientos else 0
        else:
            sesion["saldo_actual"] = sesion.get("saldo_esperado")
        return sesion
