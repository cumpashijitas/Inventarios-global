"""Entidades del dominio ventas."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.core.exceptions import DomainError


@dataclass(slots=True)
class VentaItem:
    producto_id: UUID | None
    sku: str
    nombre: str
    cantidad: Decimal
    precio_unitario: Decimal
    descuento_pct: Decimal = Decimal("0")

    @property
    def subtotal(self) -> Decimal:
        base = self.cantidad * self.precio_unitario
        return base * (1 - self.descuento_pct / 100)


@dataclass(slots=True)
class Venta:
    id: UUID
    empresa_id: UUID
    numero: str
    fecha: date
    estado: str
    metodo_pago: str
    items: list[VentaItem] = field(default_factory=list)
    cliente_id: UUID | None = None
    cliente_nombre: str | None = None
    descuento_pct: Decimal = Decimal("0")
    impuesto_pct: Decimal = Decimal("0")
    notas: str | None = None
    almacen_id: UUID | None = None
    caja_sesion_id: UUID | None = None

    ESTADOS_VALIDOS = frozenset({"borrador", "completada", "anulada"})
    METODOS_PAGO = frozenset({"efectivo", "tarjeta_credito", "tarjeta_debito", "transferencia", "mixto"})

    def __post_init__(self) -> None:
        if self.estado not in self.ESTADOS_VALIDOS:
            raise DomainError(f"estado de venta inválido: {self.estado}")
        if self.metodo_pago not in self.METODOS_PAGO:
            raise DomainError(f"método de pago inválido: {self.metodo_pago}")

    @property
    def subtotal(self) -> Decimal:
        return sum(item.subtotal for item in self.items)

    @property
    def descuento_monto(self) -> Decimal:
        return self.subtotal * self.descuento_pct / 100

    @property
    def base_imponible(self) -> Decimal:
        return self.subtotal - self.descuento_monto

    @property
    def impuesto_monto(self) -> Decimal:
        return self.base_imponible * self.impuesto_pct / 100

    @property
    def total(self) -> Decimal:
        return self.base_imponible + self.impuesto_monto

    def anular(self, motivo: str) -> None:
        if self.estado == "anulada":
            raise DomainError("la venta ya está anulada")
        self.estado = "anulada"


@dataclass(slots=True)
class CotizacionItem:
    producto_id: UUID | None
    sku: str
    nombre: str
    cantidad: Decimal
    precio_unitario: Decimal
    descuento_pct: Decimal = Decimal("0")

    @property
    def subtotal(self) -> Decimal:
        base = self.cantidad * self.precio_unitario
        return base * (1 - self.descuento_pct / 100)


@dataclass(slots=True)
class Cotizacion:
    id: UUID
    empresa_id: UUID
    numero: str
    fecha: date
    estado: str
    vigencia_dias: int = 15
    items: list[CotizacionItem] = field(default_factory=list)
    cliente_id: UUID | None = None
    cliente_nombre: str | None = None
    notas: str | None = None

    ESTADOS_VALIDOS = frozenset({"pendiente", "aprobada", "rechazada", "vencida", "convertida"})

    def __post_init__(self) -> None:
        if self.estado not in self.ESTADOS_VALIDOS:
            raise DomainError(f"estado de cotización inválido: {self.estado}")

    @property
    def total(self) -> Decimal:
        return sum(item.subtotal for item in self.items)
