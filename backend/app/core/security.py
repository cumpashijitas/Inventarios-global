"""Emisión y verificación de JWT propios de la app.

Después del cambio a JWT propio (firmado con APP_JWT_SECRET):
    - El password lo valida Supabase Auth (Supabase JWT se descarta tras login).
    - Para todas las demás requests autenticadas, el frontend manda NUESTRO JWT.
    - Nuestros claims son simples y predecibles: sub, empresa_id, rol, email, exp.

Esto nos desacopla del esquema de firma de Supabase (HS/ES/RS) y elimina la
necesidad de la Custom Access Token Hook.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import jwt

from app.core.config import settings
from app.core.exceptions import UnauthorizedError


@dataclass(frozen=True, slots=True)
class JWTClaims:
    sub: str                  # user_id (auth.users.id de Supabase)
    empresa_id: str | None    # uuid de la empresa activa
    rol: str | None
    email: str | None
    raw: dict[str, Any]


def issue_app_token(
    *,
    user_id: str,
    empresa_id: str | None,
    rol: str | None,
    email: str | None,
    expires_minutes: int | None = None,
) -> tuple[str, int]:
    """Emite un JWT firmado con APP_JWT_SECRET.

    Devuelve (token, expires_in_seconds). expires_in es lo que le decimos al
    frontend para que sepa cuándo expira.
    """
    expires_minutes = expires_minutes or settings.jwt_expires_minutes
    now = int(time.time())
    exp = now + expires_minutes * 60

    payload: dict[str, Any] = {
        "iss": settings.app_name,
        "aud": settings.jwt_audience,
        "sub": user_id,
        "empresa_id": empresa_id,
        "rol": rol,
        "email": email,
        "iat": now,
        "exp": exp,
    }
    token = jwt.encode(payload, settings.app_jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_minutes * 60


def decode_jwt(token: str) -> JWTClaims:
    """Verifica firma + audience + exp y devuelve los claims tipados."""
    try:
        payload = jwt.decode(
            token,
            settings.app_jwt_secret,
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
