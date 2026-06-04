"""Use case de devoluciones."""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

import asyncpg

from app.core.exceptions import DomainError, NotFoundError
from app.modules.caja.infrastructure.caja_repo import CajaRepository
from app.modules.devoluciones.infrastructure.devoluciones_repo import DevolucionesRepository
from app.modules.inventario.infrastructure.stock_repo import StockRepository
from app.modules.ventas.infrastructure.ventas_repo import VentasRepository


class DevolucionesUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn        = conn
        self.repo        = DevolucionesRepository(conn)
        self.ventas_repo = VentasRepository(conn)
        self.stock       = StockRepository(conn)
        self.caja_repo   = CajaRepository(conn)

    async def listar(
        self, empresa_id: UUID, page: int, page_size: int
    ) -> dict[str, Any]:
        items, total = await self.repo.listar(empresa_id, page, page_size)
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        }

    async def registrar(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        # ── 1. Verificar caja abierta ────────────────────────────────────────
        sesion = await self.caja_repo.sesion_abierta(empresa_id)
        if not sesion:
            raise DomainError(
                "No hay caja abierta. Abre la caja primero o registra la "
                "devolución en papel y cárgala al sistema cuando abras la caja."
            )

        # ── 2. Obtener venta y validar el ítem ───────────────────────────────
        venta = await self.ventas_repo.get_venta(UUID(str(data["venta_id"])))
        venta_item = next(
            (i for i in venta.get("items", [])
             if str(i["id"]) == str(data["venta_item_id"])),
            None,
        )
        if not venta_item:
            raise NotFoundError("ítem de venta no encontrado")

        cantidad_devuelta = Decimal(str(data["cantidad_devuelta"]))
        if cantidad_devuelta > Decimal(str(venta_item["cantidad"])):
            raise DomainError(
                f"La cantidad a devolver ({cantidad_devuelta}) no puede ser "
                f"mayor a la comprada ({venta_item['cantidad']})."
            )

        # ── 3. Calcular monto_devuelto ───────────────────────────────────────
        precio_unit = Decimal(str(venta_item["precio_unitario"]))
        desc_pct    = Decimal(str(venta_item.get("descuento_pct", 0)))
        precio_efectivo = precio_unit * (1 - desc_pct / 100)
        monto_devuelto  = precio_efectivo * cantidad_devuelta

        # ── 4. Calcular monto_cobrado (si hay cambio de producto) ────────────
        monto_cobrado    = Decimal("0")
        cantidad_nueva   = None
        producto_nuevo_id = data.get("producto_nuevo_id")

        if producto_nuevo_id and data.get("cantidad_nueva"):
            cantidad_nueva = Decimal(str(data["cantidad_nueva"]))
            prod_nuevo = await self.conn.fetchrow(
                "select precio_venta from public.productos where id = $1 and deleted_at is null",
                UUID(str(producto_nuevo_id)),
            )
            if not prod_nuevo:
                raise NotFoundError("producto nuevo no encontrado")
            monto_cobrado = Decimal(str(prod_nuevo["precio_venta"])) * cantidad_nueva

        # ── 5. Diferencia ────────────────────────────────────────────────────
        diferencia = monto_cobrado - monto_devuelto

        # ── 6. Obtener almacén principal ─────────────────────────────────────
        almacen_id = await self.conn.fetchval(
            """
            select id from public.almacenes
             where empresa_id = $1 and activo = true
             order by created_at
             limit 1
            """,
            empresa_id,
        )
        if not almacen_id:
            raise DomainError("No hay almacén activo configurado.")

        # ── 7. Transacción atómica ───────────────────────────────────────────
        async with self.conn.transaction():
            # a) Insertar devolución
            dev_data = {
                "venta_id":            data["venta_id"],
                "venta_item_id":       data.get("venta_item_id"),
                "motivo":              data["motivo"],
                "notas":               data.get("notas"),
                "producto_devuelto_id": data["producto_devuelto_id"],
                "cantidad_devuelta":   float(cantidad_devuelta),
                "monto_devuelto":      float(monto_devuelto),
                "producto_nuevo_id":   producto_nuevo_id,
                "cantidad_nueva":      float(cantidad_nueva) if cantidad_nueva else None,
                "monto_cobrado":       float(monto_cobrado),
                "diferencia":          float(diferencia),
            }
            devolucion = await self.repo.crear(empresa_id, user_id, dev_data)

            # b) Entrada de stock: producto devuelto
            await self.stock.registrar_movimiento(
                UUID(str(data["producto_devuelto_id"])),
                almacen_id,
                "entrada",
                float(cantidad_devuelta),
                float(precio_efectivo),
                "devolucion",
                devolucion["id"],
                f"Devolución venta {venta['numero']}",
            )

            # c) Salida de stock: producto nuevo (si hay cambio)
            if producto_nuevo_id and cantidad_nueva:
                await self.stock.registrar_movimiento(
                    UUID(str(producto_nuevo_id)),
                    almacen_id,
                    "salida",
                    float(cantidad_nueva),
                    0,
                    "devolucion",
                    devolucion["id"],
                    f"Cambio en devolución {venta['numero']}",
                )

            # d) Movimiento de caja si hay diferencia
            if diferencia != 0:
                tipo_caja = "ingreso" if diferencia > 0 else "retiro"
                mov = await self.caja_repo.registrar_movimiento(
                    empresa_id,
                    user_id,
                    sesion["id"],
                    {
                        "tipo":       tipo_caja,
                        "referencia": f"devolución #{venta['numero']}",
                        "monto":      float(abs(diferencia)),
                        "metodo_pago": "efectivo",
                        "notas":      f"Devolución {data.get('motivo', '')} — venta {venta['numero']}",
                    },
                )
                await self.repo.actualizar_caja_id(devolucion["id"], mov["id"])

        # Retornar con joins
        return await self.repo.get_con_joins(devolucion["id"])
