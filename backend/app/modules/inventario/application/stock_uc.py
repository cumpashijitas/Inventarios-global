"""Use cases de stock."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.modules.inventario.infrastructure.stock_repo import StockRepository
from app.shared.auditoria import registrar_auditoria


class StockUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = StockRepository(conn)

    async def stock_de(
        self, producto_id: UUID, almacen_id: UUID | None = None
    ) -> list[dict[str, Any]]:
        return await self.repo.stock_actual(producto_id, almacen_id)

    async def ajustar(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        ajuste: dict[str, Any],
    ) -> dict[str, Any]:
        mov_id = await self.repo.registrar_movimiento(
            producto_id=ajuste["producto_id"],
            almacen_id=ajuste["almacen_id"],
            tipo=ajuste["tipo"],
            cantidad=ajuste["cantidad"],
            costo_unitario=ajuste.get("costo_unitario", 0),
            referencia_tipo="ajuste_manual",
            motivo=ajuste.get("motivo"),
        )
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="movimiento_stock",
            entidad_id=str(mov_id),
            accion=ajuste["tipo"],
            payload_despues={k: str(v) for k, v in ajuste.items()},
        )
        return {"movimiento_id": str(mov_id)}

    async def listar_movimientos(
        self,
        producto_id: UUID | None = None,
        almacen_id: UUID | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        return await self.repo.listar_movimientos(producto_id, almacen_id, limit)
