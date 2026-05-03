"""Tipo Result[T, E] para use cases.

Alternativa a lanzar excepciones desde la capa de aplicación. Útil cuando un
use case puede fallar de varias formas previsibles (validación, conflicto,
no encontrado) y queremos forzar al caller a manejarlas explícitamente.

Para errores realmente excepcionales (DB caída, JWT inválido), seguimos
lanzando excepciones — Result se usa solo en la frontera dominio/application.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")
E = TypeVar("E")


@dataclass(frozen=True, slots=True)
class Ok(Generic[T]):
    value: T

    @property
    def is_ok(self) -> bool:
        return True

    @property
    def is_err(self) -> bool:
        return False


@dataclass(frozen=True, slots=True)
class Err(Generic[E]):
    error: E

    @property
    def is_ok(self) -> bool:
        return False

    @property
    def is_err(self) -> bool:
        return True


Result = Ok[T] | Err[E]
