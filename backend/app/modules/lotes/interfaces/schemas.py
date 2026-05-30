"""Schemas Pydantic — módulo lotes (carga masiva)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoteItemIn(BaseModel):
    producto_id: UUID | None = None
    sku: str = Field(min_length=1, max_length=50)
    nombre: str = Field(min_length=1, max_length=200)
    categoria: str | None = None
    marca: str | None = None
    precio_real: Decimal | None = Field(default=None, ge=0)
    precio_unitario: Decimal | None = Field(default=None, ge=0)
    precio_mecanico: Decimal | None = Field(default=None, ge=0)
    precio_mayor: Decimal | None = Field(default=None, ge=0)
    cantidad: Decimal = Field(default=Decimal("0"), ge=0)
    stock_minimo: Decimal = Field(default=Decimal("0"), ge=0)
    ubicacion: str | None = None
    # Campos extendidos
    proveedor: str | None = None
    aplicacion: str | None = None
    medidas: str | None = None
    peso: Decimal | None = Field(default=None, ge=0)
    modelos: str | None = None
    anio_desde: int | None = Field(default=None, ge=1900, le=2100)
    anio_hasta: int | None = Field(default=None, ge=1900, le=2100)
    descripcion: str | None = None

    @field_validator("cantidad", "stock_minimo", mode="before")
    @classmethod
    def _coerce_decimal_zero(cls, v: object) -> object:
        """Convierte None o string vacío a 0 en lugar de fallar."""
        if v is None or (isinstance(v, str) and not v.strip()):
            return Decimal("0")
        return v

    @field_validator("precio_real", "precio_unitario", "precio_mecanico", "precio_mayor", "peso", mode="before")
    @classmethod
    def _coerce_decimal_none(cls, v: object) -> object:
        """Convierte string vacío a None en campos de precio opcionales."""
        if isinstance(v, str) and not v.strip():
            return None
        return v


class LoteItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    lote_id: UUID
    producto_id: UUID | None = None
    sku: str
    nombre: str
    categoria: str | None = None
    marca: str | None = None
    precio_real: Decimal | None = None
    precio_unitario: Decimal | None = None
    precio_mecanico: Decimal | None = None
    precio_mayor: Decimal | None = None
    cantidad: Decimal
    stock_minimo: Decimal
    ubicacion: str | None = None
    proveedor: str | None = None
    aplicacion: str | None = None
    medidas: str | None = None
    peso: Decimal | None = None
    modelos: str | None = None
    anio_desde: int | None = None
    anio_hasta: int | None = None
    descripcion: str | None = None
    procesado: bool


class ItemsIn(BaseModel):
    """Wrapper para recibir lista de ítems desde el frontend."""
    items: list[LoteItemIn]


class LoteIn(BaseModel):
    referencia: str = Field(min_length=1, max_length=60)
    proveedor_id: UUID | None = None
    proveedor_nombre: str | None = None
    fecha: date = Field(default_factory=date.today)
    notas: str | None = None


class LoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    referencia: str
    proveedor_id: UUID | None = None
    proveedor_nombre: str | None = None
    fecha: date
    estado: str
    productos_count: int
    total_estimado: Decimal | None = None
    notas: str | None = None
    created_at: datetime
    items: list[LoteItemOut] = []


class PageOut(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
