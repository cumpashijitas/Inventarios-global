"""Use cases de ventas y cotizaciones."""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

import asyncpg

from app.modules.caja.infrastructure.caja_repo import CajaRepository
from app.modules.inventario.infrastructure.stock_repo import StockRepository
from app.modules.ventas.infrastructure.ventas_repo import VentasRepository
from app.shared.auditoria import registrar_auditoria

log = logging.getLogger(__name__)


class VentasUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = VentasRepository(conn)
        self.stock = StockRepository(conn)

    async def listar(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        search: str | None,
        estado: str | None,
        user_id_filter: UUID | None = None,  # None = admin (ve todas)
    ) -> dict[str, Any]:
        items, total = await self.repo.listar_ventas(
            empresa_id, page, page_size, search, estado, user_id_filter
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        }

    async def obtener(self, venta_id: UUID) -> dict[str, Any]:
        return await self.repo.get_venta(venta_id)

    async def crear(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        almacen_id: UUID,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        """Crear venta + descontar stock + registrar en caja si aplica."""
        items = data.get("items", [])
        subtotal = sum(
            Decimal(str(i["cantidad"])) * Decimal(str(i["precio_unitario"]))
            * (1 - Decimal(str(i.get("descuento_pct", 0))) / 100)
            for i in items
        )
        descuento_pct = Decimal(str(data.get("descuento_pct", 0)))
        descuento_monto = subtotal * descuento_pct / 100
        impuesto_pct = Decimal(str(data.get("impuesto_pct", 0)))
        impuesto_monto = (subtotal - descuento_monto) * impuesto_pct / 100
        total = subtotal - descuento_monto + impuesto_monto

        for item in items:
            item["subtotal"] = float(
                Decimal(str(item["cantidad"])) * Decimal(str(item["precio_unitario"]))
                * (1 - Decimal(str(item.get("descuento_pct", 0))) / 100)
            )

        data.update({
            "numero": await self.repo.next_numero_venta(empresa_id),
            "fecha": data.get("fecha", date.today()),
            "subtotal": float(subtotal),
            "descuento_monto": float(descuento_monto),
            "impuesto_monto": float(impuesto_monto),
            "total": float(total),
        })

        venta = await self.repo.crear_venta(empresa_id, user_id, data)

        # Descontar stock por cada ítem con producto_id
        for item in items:
            if item.get("producto_id") and almacen_id:
                await self.stock.registrar_movimiento(
                    UUID(str(item["producto_id"])),
                    almacen_id,
                    "salida",
                    item["cantidad"],
                    item.get("costo_unitario", 0),
                    "venta",
                    venta["id"],
                    f"Venta {venta['numero']}",
                )

        # Registrar en caja si hay sesión abierta (sin interrumpir la venta si falla)
        try:
            caja_repo = CajaRepository(self.conn)
            sesion = await caja_repo.sesion_abierta(empresa_id)
            if sesion:
                await caja_repo.registrar_movimiento(
                    empresa_id,
                    user_id,
                    sesion["id"],
                    {
                        "tipo": "venta",
                        "referencia": venta["numero"],
                        "monto": float(total),
                        "metodo_pago": data.get("metodo_pago", "efectivo"),
                        "notas": f"Venta {venta['numero']}",
                    },
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("No se pudo registrar la venta %s en caja: %s", venta.get("numero"), exc)

        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="ventas",
            entidad="venta",
            entidad_id=str(venta["id"]),
            accion="crear",
            payload_despues={"numero": venta["numero"], "total": str(total)},
        )
        return venta

    async def anular(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        venta_id: UUID,
        motivo: str,
    ) -> dict[str, Any]:
        venta = await self.repo.get_venta(venta_id)
        resultado = await self.repo.anular_venta(venta_id, motivo, user_id)

        # Devolver stock
        almacen_id = venta.get("almacen_id")
        if almacen_id:
            for item in venta.get("items", []):
                if item.get("producto_id"):
                    await self.stock.registrar_movimiento(
                        UUID(str(item["producto_id"])),
                        UUID(str(almacen_id)),
                        "entrada",
                        item["cantidad"],
                        item.get("costo_unitario", 0),
                        "devolucion",
                        venta_id,
                        f"Anulación venta {venta['numero']}",
                    )

        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="ventas",
            entidad="venta",
            entidad_id=str(venta_id),
            accion="anular",
            payload_antes={"numero": venta["numero"], "estado": "completada"},
            payload_despues={"estado": "anulada", "motivo": motivo},
        )
        return resultado


class CotizacionesUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = VentasRepository(conn)

    async def listar(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        estado: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        items, total = await self.repo.listar_cotizaciones(
            empresa_id, page, page_size, estado, search
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        }

    async def obtener(self, cotizacion_id: UUID) -> dict[str, Any]:
        return await self.repo.get_cotizacion(cotizacion_id)

    async def crear(self, empresa_id: UUID, user_id: UUID | None, data: dict[str, Any]) -> dict[str, Any]:
        items = data.get("items", [])
        subtotal = sum(
            Decimal(str(i["cantidad"])) * Decimal(str(i["precio_unitario"]))
            * (1 - Decimal(str(i.get("descuento_pct", 0))) / 100)
            for i in items
        )
        for item in items:
            item["subtotal"] = float(
                Decimal(str(item["cantidad"])) * Decimal(str(item["precio_unitario"]))
                * (1 - Decimal(str(item.get("descuento_pct", 0))) / 100)
            )
        data.update({
            "numero": await self.repo.next_numero_cotizacion(empresa_id),
            "fecha": data.get("fecha", date.today()),
            "subtotal": float(subtotal),
            "total": float(subtotal - Decimal(str(data.get("descuento_monto", 0)))),
        })
        cot = await self.repo.crear_cotizacion(empresa_id, user_id, data)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="ventas",
            entidad="cotizacion",
            entidad_id=str(cot["id"]),
            accion="crear",
            payload_despues={"numero": cot["numero"], "total": str(subtotal)},
        )
        return cot

    async def actualizar_estado(
        self, empresa_id: UUID, user_id: UUID | None, cotizacion_id: UUID, estado: str
    ) -> dict[str, Any]:
        resultado = await self.repo.actualizar_estado_cotizacion(cotizacion_id, estado, user_id)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="ventas",
            entidad="cotizacion",
            entidad_id=str(cotizacion_id),
            accion="cambiar_estado",
            payload_despues={"estado": estado},
        )
        return resultado
