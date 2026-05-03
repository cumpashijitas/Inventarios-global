"""Verificación de JWT (Supabase) y extracción de claims.

Supabase emite JWT firmados con HS256 usando el JWT secret del proyecto.
El backend verifica firma + audience + expiración, y extrae claims customizados
(`empresa_id`, `rol`) que el Custom Access Token Hook agrega al token.

Si todavía no configuraste la hook, puedes inyectar `empresa_id` desde el
backend al hacer login (workaround temporal). Pero la solución correcta es la
hook — la dejamos documentada en docs/auth-hook.md (TODO).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import jwt

from app.core.config import settings
from app.core.exceptions import UnauthorizedError


@dataclass(frozen=True, slots=True)
class JWTClaims:
    """Claims que esperamos en el JWT de Supabase + customizados del SaaS."""

    sub: str                  # user_id (auth.users.id)
    empresa_id: str | None    # uuid de la empresa activa (claim customizado)
    rol: str | None           # rol del usuario en esa empresa
    email: str | None
    raw: dict[str, Any]       # payload crudo por si algún módulo necesita más


def decode_jwt(token: str) -> JWTClaims:
    """Verifica firma + audience + exp y devuelve los claims tipados.

    Lanza UnauthorizedError si el token es inválido por cualquier motivo.
    Usar este wrapper en vez de jwt.decode() directo para tener errores
    consistentes en toda la app.
    """
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as e:
        raise UnauthorizedError("token expirado") from e
    except jwt.InvalidAudienceError as e:
        raise UnauthorizedError("audience inválido") from e
    except jwt.InvalidTokenError as e:
        raise UnauthorizedError(f"token inválido: {e}") from e

    return JWTClaims(
        sub=str(payload["sub"]),
        empresa_id=payload.get("empresa_id"),
        rol=payload.get("rol"),
        email=payload.get("email"),
        raw=payload,
    )
