"""Schemas Pydantic — frontera HTTP del módulo inventario.

Mantienen los nombres en snake_case (consistencia DB ↔ API ↔ frontend).
Se traducen a/desde entidades de dominio en los use cases.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------- Almacenes ----------
class AlmacenIn(BaseModel):
    codigo: str = Field(min_length=1, max_length=30)
    nombre: str = Field(min_length=1, max_length=120)
    tipo: Literal["fisico", "movil", "consigna"] = "fisico"
    direccion: str | None = None
    ciudad: str | None = None


class AlmacenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    codigo: str
    nombre: str
    tipo: str
    direccion: str | None = None
    ciudad: str | None = None
    activo: bool


# ---------- Productos ----------
class ProductoIn(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    nombre: str = Field(min_length=1, max_length=200)
    descripcion: str | None = None
    codigo_barras: str | None = None
    categoria_id: UUID | None = None
    unidad_id: UUID
    precio_compra: Decimal = Field(default=Decimal("0"), ge=0)
    precio_venta: Decimal = Field(default=Decimal("0"), ge=0)
    moneda: str = Field(default="BOB", min_length=3, max_length=3)
    stock_minimo: Decimal = Field(default=Decimal("0"), ge=0)
    stock_maximo: Decimal | None = Field(default=None, ge=0)
    controla_stock: bool = True
    imagen_url: str | None = None


class ProductoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    descripcion: str | None = None
    categoria_id: UUID | None = None
    precio_compra: Decimal | None = Field(default=None, ge=0)
    precio_venta: Decimal | None = Field(default=None, ge=0)
    stock_minimo: Decimal | None = Field(default=None, ge=0)
    stock_maximo: Decimal | None = Field(default=None, ge=0)
    activo: bool | None = None
    imagen_url: str | None = None


class ProductoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    sku: str
    nombre: str
    descripcion: str | None = None
    categoria_id: UUID | None = None
    unidad_id: UUID
    precio_compra: Decimal
    precio_venta: Decimal
    stock_minimo: Decimal
    stock_maximo: Decimal | None = None
    controla_stock: bool
    activo: bool
    imagen_url: str | None = None
    created_at: datetime
    updated_at: datetime


# ---------- Stock / Movimientos ----------
class AjusteStockIn(BaseModel):
    producto_id: UUID
    almacen_id: UUID
    tipo: Literal["entrada", "salida", "ajuste"]
    cantidad: Decimal = Field(gt=0)
    costo_unitario: Decimal = Field(default=Decimal("0"), ge=0)
    motivo: str | None = None


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    producto_id: UUID
    almacen_id: UUID
    cantidad: Decimal
    costo_promedio: Decimal
    updated_at: datetime


class MovimientoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    producto_id: UUID
    almacen_id: UUID
    tipo: str
    cantidad: Decimal
    costo_unitario: Decimal
    referencia_tipo: str | None = None
    referencia_id: UUID | None = None
    motivo: str | None = None
    created_at: datetime


# ---------- Paginación ----------
class PageOut(BaseModel):
    """Wrapper genérico paginado. items es list[Any] para mantenerlo simple."""

    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
