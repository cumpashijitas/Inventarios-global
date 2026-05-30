"""Schemas Pydantic — módulo caja."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AbrirCajaIn(BaseModel):
    codigo: str = Field(default="CAJA-001", min_length=1, max_length=30)
    cajero_nombre: str | None = None
    saldo_inicial: Decimal = Field(default=Decimal("0"), ge=0)
    almacen_id: UUID | None = None


class CerrarCajaIn(BaseModel):
    saldo_final: Decimal = Field(ge=0)
    notas: str | None = None


class MovimientoCajaIn(BaseModel):
    tipo: Literal["ingreso", "retiro"]
    monto: Decimal = Field(gt=0)
    referencia: str | None = None
    concepto: str | None = None
    notas: str | None = None
    metodo_pago: str = "efectivo"


class MovimientoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    sesion_id: UUID
    tipo: str
    referencia: str | None = None
    metodo_pago: str | None = None
    monto: Decimal
    saldo_acumulado: Decimal
    notas: str | None = None
    created_at: datetime


class MetodoPagoResumen(BaseModel):
    metodo_pago: str
    total: Decimal
    transacciones: int


class SesionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    codigo: str
    cajero_nombre: str | None = None
    estado: str
    saldo_inicial: Decimal
    saldo_final: Decimal | None = None
    saldo_actual: Decimal | None = None
    diferencia: Decimal | None = None
    abierta_en: datetime
    cerrada_en: datetime | None = None
    movimientos: list[MovimientoOut] = []
    metodos_pago: list[MetodoPagoResumen] = []


class SesionResumenOut(BaseModel):
    """Resumen de una sesión para el listado de historial (sin movimientos)."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    codigo: str
    cajero_nombre: str | None = None
    estado: str
    saldo_inicial: Decimal
    saldo_final: Decimal | None = None
    saldo_esperado: Decimal | None = None
    diferencia: Decimal | None = None
    total_ingresos: Decimal = Decimal("0")
    total_retiros: Decimal = Decimal("0")
    num_ventas: int = 0
    abierta_en: datetime
    cerrada_en: datetime | None = None


class HistorialOut(BaseModel):
    items: list[SesionResumenOut]
    total: int
    page: int
    page_size: int
    total_pages: int
