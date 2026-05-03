"""Jerarquía de excepciones de aplicación.

Regla: el dominio y los use cases lanzan estas excepciones (no HTTPException).
El handler global las traduce a respuestas HTTP coherentes. Esto mantiene el
dominio independiente de FastAPI.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base de todos los errores manejados de aplicación."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


# --- 4xx ---
class BadRequestError(AppError):
    status_code = 400
    code = "bad_request"


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


class PaymentRequiredError(AppError):
    """Suscripción inactiva, morosa o cancelada."""

    status_code = 402
    code = "payment_required"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class ModuleNotEnabledError(ForbiddenError):
    """El plan/addon de la empresa no incluye el módulo solicitado.

    El frontend usa `details.upgrade_to` para mostrar modal de upsell.
    """

    code = "module_not_enabled"

    def __init__(self, modulo: str, *, upgrade_to: str | None = None) -> None:
        super().__init__(
            f"El módulo '{modulo}' no está habilitado para esta empresa",
            details={"modulo": modulo, "upgrade_to": upgrade_to},
        )


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"


# --- Dominio ---
class DomainError(AppError):
    """Violación de regla de negocio. Por defecto 422."""

    status_code = 422
    code = "domain_error"


class StockInsuficienteError(DomainError):
    code = "stock_insuficiente"

    def __init__(self, producto_id: str, almacen_id: str, disponible: float) -> None:
        super().__init__(
            "Stock insuficiente para la operación",
            details={
                "producto_id": producto_id,
                "almacen_id": almacen_id,
                "disponible": disponible,
            },
        )
