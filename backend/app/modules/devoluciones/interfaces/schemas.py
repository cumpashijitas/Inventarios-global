"""Schemas Pydantic — módulo devoluciones."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


MOTIVOS = Literal["error_nuestro", "defecto_fabrica", "cambio_medida", "otro"]

MOTIVO_LABELS = {
    "error_nuestro":  "Error nuestro",
    "defecto_fabrica": "Defecto de fábrica",
    "cambio_medida":  "Cambio de talla / medida",
    "otro":           "Otro",
}


class DevolucionIn(BaseModel):
    venta_id:             UUID
    venta_item_id:        UUID
    producto_devuelto_id: UUID
    cantidad_devuelta:    Decimal = Field(gt=0)
    motivo:               MOTIVOS
    notas:                str | None = None
    # Intercambio (opcional)
    producto_nuevo_id:    UUID | None = None
    cantidad_nueva:       Decimal | None = Field(default=None, gt=0)


class DevolucionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:                       UUID
    empresa_id:               UUID
    venta_id:                 UUID
    venta_item_id:            UUID | None
    venta_numero:             str | None
    atendido_por:             UUID | None
    motivo:                   str
    notas:                    str | None
    producto_devuelto_id:     UUID
    producto_devuelto_nombre: str | None
    producto_devuelto_sku:    str | None
    cantidad_devuelta:        Decimal
    monto_devuelto:           Decimal
    producto_nuevo_id:        UUID | None
    producto_nuevo_nombre:    str | None
    producto_nuevo_sku:       str | None
    cantidad_nueva:           Decimal | None
    monto_cobrado:            Decimal
    diferencia:               Decimal
    movimiento_caja_id:       UUID | None
    created_at:               datetime


class PageDevolucionOut(BaseModel):
    items:       list[DevolucionOut]
    total:       int
    page:        int
    page_size:   int
    total_pages: int
