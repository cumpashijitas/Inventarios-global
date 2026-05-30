"""Use cases de caja."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.modules.caja.infrastructure.caja_repo import CajaRepository
from app.shared.auditoria import registrar_auditoria


class CajaUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = CajaRepository(conn)

    async def estado_actual(self, empresa_id: UUID) -> dict[str, Any] | None:
        sesion = await self.repo.sesion_abierta(empresa_id)
        if not sesion:
            return None
        movimientos = await self.repo.listar_movimientos(sesion["id"])
        metodos = await self.repo.resumen_metodos_pago(sesion["id"])
        sesion["movimientos"] = movimientos
        sesion["metodos_pago"] = metodos
        # Calcular saldo actual
        sesion["saldo_actual"] = sum(m["monto"] for m in movimientos)
        return sesion

    async def abrir(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        sesion = await self.repo.abrir_sesion(empresa_id, user_id, data)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="caja",
            entidad="sesion",
            entidad_id=str(sesion["id"]),
            accion="abrir",
            payload_despues={"codigo": sesion["codigo"], "saldo_inicial": str(sesion["saldo_inicial"])},
        )
        return sesion

    async def cerrar(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        sesion_id: UUID,
        saldo_final: float,
        notas: str | None,
    ) -> dict[str, Any]:
        sesion = await self.repo.cerrar_sesion(empresa_id, user_id, sesion_id, saldo_final, notas)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="caja",
            entidad="sesion",
            entidad_id=str(sesion_id),
            accion="cerrar",
            payload_despues={
                "saldo_final": str(saldo_final),
                "diferencia": str(sesion.get("diferencia", 0)),
            },
        )
        return sesion

    async def registrar_movimiento(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        # Verificar sesión activa
        sesion = await self.repo.sesion_abierta(empresa_id)
        if not sesion:
            from app.core.exceptions import DomainError
            raise DomainError("no hay caja abierta")

        movimiento = await self.repo.registrar_movimiento(
            empresa_id, user_id, sesion["id"], data
        )
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="caja",
            entidad="movimiento",
            entidad_id=str(movimiento["id"]),
            accion=data["tipo"],
            payload_despues={"monto": str(data["monto"]), "concepto": data.get("referencia", "")},
        )
        return movimiento

    async def listar_movimientos(self, empresa_id: UUID) -> list[dict[str, Any]]:
        sesion = await self.repo.sesion_abierta(empresa_id)
        if not sesion:
            return []
        return await self.repo.listar_movimientos(sesion["id"])

    async def historial(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        desde: Any = None,
        hasta: Any = None,
    ) -> dict[str, Any]:
        items, total = await self.repo.listar_sesiones(
            empresa_id, page, page_size, desde, hasta
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        }

    async def detalle_sesion(
        self, empresa_id: UUID, sesion_id: UUID
    ) -> dict[str, Any] | None:
        return await self.repo.get_sesion_detalle(empresa_id, sesion_id)
