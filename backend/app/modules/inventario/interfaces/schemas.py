"""Schemas Pydantic — frontera HTTP del módulo inventario.

Mantienen los nombres en snake_case (consistencia DB ↔ API ↔ frontend).
Se traducen a/desde entidades de dominio en los use cases.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    precio_compra: Decimal = Field(default=Decimal("0"), ge=0)   # precio real / costo
    precio_venta: Decimal = Field(default=Decimal("0"), ge=0)    # precio público unitario
    precio_mecanico: Decimal | None = Field(default=None, ge=0)
    precio_mayor: Decimal | None = Field(default=None, ge=0)
    moneda: str = Field(default="BOB", min_length=3, max_length=3)
    stock_minimo: Decimal = Field(default=Decimal("0"), ge=0)
    stock_maximo: Decimal | None = Field(default=None, ge=0)
    controla_stock: bool = True
    imagen_url: str | None = None
    marca: str | None = None
    proveedor_id: UUID | None = None
    aplicacion: str | None = None
    medidas: str | None = None
    peso: Decimal | None = Field(default=None, ge=0)
    modelos: str | None = None
    anio_desde: int | None = Field(default=None, ge=1900, le=2100)
    anio_hasta: int | None = Field(default=None, ge=1900, le=2100)
    ubicacion: str | None = None


class ProductoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    descripcion: str | None = None
    categoria_id: UUID | None = None
    precio_compra: Decimal | None = Field(default=None, ge=0)
    precio_venta: Decimal | None = Field(default=None, ge=0)
    precio_mecanico: Decimal | None = Field(default=None, ge=0)
    precio_mayor: Decimal | None = Field(default=None, ge=0)
    stock_minimo: Decimal | None = Field(default=None, ge=0)
    stock_maximo: Decimal | None = Field(default=None, ge=0)
    activo: bool | None = None
    imagen_url: str | None = None
    marca: str | None = None
    proveedor_id: UUID | None = None
    aplicacion: str | None = None
    medidas: str | None = None
    peso: Decimal | None = Field(default=None, ge=0)
    modelos: str | None = None
    anio_desde: int | None = None
    anio_hasta: int | None = None
    ubicacion: str | None = None


class ProductoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    sku: str
    nombre: str
    descripcion: str | None = None
    categoria_id: UUID | None = None
    unidad_id: UUID
    precio_compra: Decimal                      # = precioReal en frontend
    precio_venta: Decimal                       # = precioUnitario en frontend
    precio_mecanico: Decimal | None = None
    precio_mayor: Decimal | None = None
    stock_minimo: Decimal
    stock_maximo: Decimal | None = None
    controla_stock: bool
    activo: bool
    imagen_url: str | None = None
    marca: str | None = None
    proveedor_id: UUID | None = None
    aplicacion: str | None = None
    medidas: str | None = None
    peso: Decimal | None = None
    modelos: str | None = None
    anio_desde: int | None = None
    anio_hasta: int | None = None
    ubicacion: str | None = None
    stock_total: Decimal | None = None   # calculado por JOIN con stock_actual
    created_at: datetime
    updated_at: datetime


# ---------- Proveedores ----------
class ProveedorIn(BaseModel):
    codigo: str | None = None
    razon_social: str = Field(min_length=1, max_length=200)
    nombre_contacto: str | None = None
    email: str | None = None
    telefono: str | None = None
    celular: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    pais: str = Field(default="BO", min_length=2, max_length=2)
    nit: str | None = None
    categoria: str = "general"
    banco: str | None = None
    cuenta_bancaria: str | None = None
    notas: str | None = None


class ProveedorUpdate(BaseModel):
    razon_social: str | None = Field(default=None, min_length=1)
    nombre_contacto: str | None = None
    email: str | None = None
    telefono: str | None = None
    celular: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    pais: str | None = Field(default=None, min_length=2, max_length=2)   # código ISO-3166 alpha-2
    nit: str | None = None
    categoria: str | None = None
    banco: str | None = None
    cuenta_bancaria: str | None = None
    notas: str | None = None
    activo: bool | None = None

    @field_validator("pais", mode="before")
    @classmethod
    def _pais_upper(cls, v: str | None) -> str | None:
        """Acepta 'bo' o 'BO' y normaliza a mayúsculas."""
        return v.strip().upper() if isinstance(v, str) else v


class ProveedorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    codigo: str | None = None
    razon_social: str
    nombre_contacto: str | None = None
    email: str | None = None
    telefono: str | None = None
    celular: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    pais: str
    nit: str | None = None
    categoria: str
    banco: str | None = None
    cuenta_bancaria: str | None = None
    notas: str | None = None
    activo: bool
    created_at: datetime


# ---------- Clientes ----------
class ClienteIn(BaseModel):
    codigo: str | None = None
    nombre: str = Field(min_length=1, max_length=200)
    tipo: Literal["mecanico", "mayorista", "particular"] = "particular"
    email: str | None = None
    telefono: str | None = None
    celular: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    pais: str = Field(default="BO", min_length=2, max_length=2)
    nit: str | None = None
    limite_credito: Decimal = Field(default=Decimal("0"), ge=0)
    dias_credito: int = Field(default=0, ge=0)
    descuento_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    notas: str | None = None


class ClienteUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1)
    tipo: Literal["mecanico", "mayorista", "particular"] | None = None
    email: str | None = None
    telefono: str | None = None
    celular: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    nit: str | None = None
    limite_credito: Decimal | None = Field(default=None, ge=0)
    dias_credito: int | None = Field(default=None, ge=0)
    descuento_pct: Decimal | None = Field(default=None, ge=0, le=100)
    notas: str | None = None
    activo: bool | None = None


class ClienteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    codigo: str | None = None
    nombre: str
    tipo: str
    email: str | None = None
    telefono: str | None = None
    celular: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    nit: str | None = None
    limite_credito: Decimal
    dias_credito: int
    descuento_pct: Decimal
    notas: str | None = None
    activo: bool
    created_at: datetime


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


# ---------- Categorías ----------
class CategoriaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    parent_id: UUID | None = None
    orden: int = Field(default=0, ge=0)


class CategoriaUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    parent_id: UUID | None = None
    orden: int | None = Field(default=None, ge=0)
    activo: bool | None = None


class CategoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    nombre: str
    parent_id: UUID | None = None
    orden: int
    activo: bool


# ---------- Unidades de Medida ----------
class UnidadMedidaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    codigo: str
    nombre: str
    decimales: int
    activo: bool


# ---------- Imagen producto ----------
class ImagenProductoOut(BaseModel):
    imagen_url: str


# ---------- Paginación ----------
class PageOut(BaseModel):
    """Wrapper genérico paginado. items es list[Any] para mantenerlo simple."""

    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
