"""Schemas Pydantic — módulo ventas."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── Ítems ───────────────────────────────────────────────────────────────────
class VentaItemIn(BaseModel):
    producto_id: UUID | None = None
    sku: str
    nombre: str
    cantidad: Decimal = Field(gt=0)
    precio_unitario: Decimal = Field(ge=0)
    descuento_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    costo_unitario: Decimal = Field(default=Decimal("0"), ge=0)


class VentaItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    producto_id: UUID | None = None
    sku: str
    nombre: str
    cantidad: Decimal
    precio_unitario: Decimal
    descuento_pct: Decimal
    subtotal: Decimal
    costo_unitario: Decimal


# ─── Ventas ───────────────────────────────────────────────────────────────────
class VentaIn(BaseModel):
    cliente_id: UUID | None = None
    cliente_nombre: str | None = None
    cliente_nit: str | None = None
    fecha: date = Field(default_factory=date.today)
    metodo_pago: Literal["efectivo","tarjeta_credito","tarjeta_debito","transferencia","mixto"] = "efectivo"
    descuento_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    impuesto_pct: Decimal = Field(default=Decimal("0"), ge=0)
    monto_pagado: Decimal | None = None
    almacen_id: UUID | None = None
    caja_sesion_id: UUID | None = None
    notas: str | None = None
    items: list[VentaItemIn] = Field(min_length=1)


class VentaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    numero: str
    cliente_id: UUID | None = None
    cliente_nombre: str | None = None
    cliente_tipo: str | None = None       # del JOIN con clientes
    vendedor_nombre: str | None = None    # del JOIN con usuarios_empresa
    fecha: date
    estado: str
    metodo_pago: str
    subtotal: Decimal
    descuento_pct: Decimal
    descuento_monto: Decimal
    impuesto_monto: Decimal
    total: Decimal
    monto_pagado: Decimal | None = None
    cambio: Decimal | None = None
    notas: str | None = None
    created_at: datetime
    items: list[VentaItemOut] = []


class AnularVentaIn(BaseModel):
    motivo: str = Field(min_length=3)


# ─── Cotizaciones ─────────────────────────────────────────────────────────────
class CotizacionItemIn(BaseModel):
    producto_id: UUID | None = None
    sku: str
    nombre: str
    cantidad: Decimal = Field(gt=0)
    precio_unitario: Decimal = Field(ge=0)
    descuento_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class CotizacionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    producto_id: UUID | None = None
    sku: str
    nombre: str
    cantidad: Decimal
    precio_unitario: Decimal
    descuento_pct: Decimal
    subtotal: Decimal


class CotizacionIn(BaseModel):
    cliente_id: UUID | None = None
    cliente_nombre: str | None = None
    fecha: date = Field(default_factory=date.today)
    vigencia_dias: int = Field(default=15, ge=1, le=365)
    descuento_monto: Decimal = Field(default=Decimal("0"), ge=0)
    notas: str | None = None
    items: list[CotizacionItemIn] = Field(min_length=1)


class CotizacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    numero: str
    cliente_id: UUID | None = None
    cliente_nombre: str | None = None
    cliente_tipo: str | None = None       # del JOIN con clientes
    vendedor_nombre: str | None = None    # del JOIN con usuarios_empresa
    fecha: date
    fecha_vence: date | None = None       # columna generada en DB
    vigencia_dias: int
    estado: str
    subtotal: Decimal
    descuento_monto: Decimal
    total: Decimal
    notas: str | None = None
    created_at: datetime
    items: list[CotizacionItemOut] = []


class CambiarEstadoCotizacionIn(BaseModel):
    estado: Literal["pendiente","aprobada","rechazada","vencida","convertida"]


# ─── Paginación ───────────────────────────────────────────────────────────────
class PageOut(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
