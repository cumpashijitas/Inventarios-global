"""Entidades del dominio inventario.

Entidades = tienen identidad (id) y ciclo de vida. Llevan reglas de negocio
en sus métodos. NO heredan de BaseModel ni saben nada de DB.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.core.exceptions import DomainError
from app.modules.inventario.domain.value_objects import SKU, Cantidad, Precio


@dataclass(slots=True)
class Producto:
    id: UUID
    empresa_id: UUID
    sku: SKU
    nombre: str
    unidad_id: UUID
    precio_compra: Precio
    precio_venta: Precio
    stock_minimo: Cantidad
    controla_stock: bool = True
    activo: bool = True
    descripcion: str | None = None
    codigo_barras: str | None = None
    categoria_id: UUID | None = None
    stock_maximo: Cantidad | None = None
    imagen_url: str | None = None
    metadatos: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.nombre or not self.nombre.strip():
            raise DomainError("nombre del producto requerido")
        if self.controla_stock and self.precio_venta.monto < self.precio_compra.monto:
            # Permitido pero advertencia: por ahora no bloqueamos (puede haber
            # ofertas/liquidaciones). Solo se valida que ambos sean no-negativos
            # vía Precio.
            pass

    def renombrar(self, nuevo_nombre: str) -> None:
        if not nuevo_nombre or not nuevo_nombre.strip():
            raise DomainError("nombre del producto requerido")
        self.nombre = nuevo_nombre.strip()

    def actualizar_precios(self, compra: Precio, venta: Precio) -> None:
        if compra.moneda != venta.moneda:
            raise DomainError("precios deben estar en la misma moneda")
        self.precio_compra = compra
        self.precio_venta = venta

    def desactivar(self) -> None:
        self.activo = False

    def margen_bruto(self) -> Decimal:
        if self.precio_compra.monto == 0:
            return Decimal("0")
        return (
            (self.precio_venta.monto - self.precio_compra.monto) / self.precio_compra.monto
        )


@dataclass(slots=True)
class Almacen:
    id: UUID
    empresa_id: UUID
    codigo: str
    nombre: str
    tipo: str = "fisico"  # 'fisico' | 'movil' | 'consigna'
    activo: bool = True
    direccion: str | None = None
    ciudad: str | None = None

    def __post_init__(self) -> None:
        if not self.codigo or not self.codigo.strip():
            raise DomainError("código del almacén requerido")
        if self.tipo not in {"fisico", "movil", "consigna"}:
            raise DomainError(f"tipo de almacén inválido: {self.tipo}")


@dataclass(slots=True)
class Stock:
    """Snapshot de stock de un producto en un almacén."""

    producto_id: UUID
    almacen_id: UUID
    cantidad: Decimal
    costo_promedio: Decimal
    actualizado_en: datetime

    def disponible_para(self, cantidad_solicitada: Cantidad) -> bool:
        return self.cantidad >= cantidad_solicitada.valor


@dataclass(slots=True)
class MovimientoStock:
    """Registro inmutable de un cambio de stock."""

    id: UUID
    empresa_id: UUID
    producto_id: UUID
    almacen_id: UUID
    tipo: str
    cantidad: Cantidad
    costo_unitario: Precio
    creado_en: datetime
    referencia_tipo: str | None = None
    referencia_id: UUID | None = None
    motivo: str | None = None
    user_id: UUID | None = None

    TIPOS_VALIDOS = frozenset(
        {"entrada", "salida", "ajuste", "transferencia_in", "transferencia_out"}
    )

    def __post_init__(self) -> None:
        if self.tipo not in self.TIPOS_VALIDOS:
            raise DomainError(
                f"tipo de movimiento inválido: {self.tipo}",
                details={"tipos_validos": sorted(self.TIPOS_VALIDOS)},
            )
