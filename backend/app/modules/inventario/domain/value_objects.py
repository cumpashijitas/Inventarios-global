"""Value objects del dominio inventario.

Reglas:
    - Inmutables (frozen).
    - Validan invariantes en __post_init__.
    - No tienen identidad (dos VOs con mismo valor son iguales).
    - No importan nada de FastAPI ni asyncpg.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

from app.core.exceptions import DomainError

_SKU_RE = re.compile(r"^[A-Z0-9][A-Z0-9_\-./]{0,49}$", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class SKU:
    valor: str

    def __post_init__(self) -> None:
        if not self.valor or not _SKU_RE.match(self.valor):
            raise DomainError(
                "SKU inválido: alfanumérico, hasta 50 chars, sin espacios",
                details={"sku": self.valor},
            )

    def __str__(self) -> str:
        return self.valor


@dataclass(frozen=True, slots=True)
class Cantidad:
    """Cantidad de stock. Siempre no-negativa cuando representa disponibilidad,
    pero permite negativa cuando representa un delta (movimiento)."""

    valor: Decimal

    def __post_init__(self) -> None:
        # Coerción segura: aceptar int/float al construir, normalizar a Decimal
        if not isinstance(self.valor, Decimal):
            object.__setattr__(self, "valor", Decimal(str(self.valor)))

    @classmethod
    def positiva(cls, valor: Decimal | float | int) -> "Cantidad":
        c = cls(Decimal(str(valor)))
        if c.valor <= 0:
            raise DomainError("la cantidad debe ser positiva", details={"valor": str(c.valor)})
        return c

    def __str__(self) -> str:
        return str(self.valor)


@dataclass(frozen=True, slots=True)
class Precio:
    """Precio en una moneda. Siempre no-negativo."""

    monto: Decimal
    moneda: str = "BOB"

    def __post_init__(self) -> None:
        if not isinstance(self.monto, Decimal):
            object.__setattr__(self, "monto", Decimal(str(self.monto)))
        if self.monto < 0:
            raise DomainError("precio no puede ser negativo", details={"monto": str(self.monto)})
        if len(self.moneda) != 3 or not self.moneda.isalpha():
            raise DomainError("moneda debe ser código ISO de 3 letras", details={"moneda": self.moneda})

    def __str__(self) -> str:
        return f"{self.monto} {self.moneda}"
