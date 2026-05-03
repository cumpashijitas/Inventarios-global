"""Adapter al Supabase Auth API.

Encapsula las llamadas HTTP a `${SUPABASE_URL}/auth/v1/...` para que el use
case no sepa nada de Supabase. Si mañana cambiamos a Auth0 o a auth propio,
solo cambiamos esta clase.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import UnauthorizedError


class SupabaseAuthAdapter:
    def __init__(self) -> None:
        self._base = f"{settings.supabase_url.rstrip('/')}/auth/v1"
        self._headers = {
            "apikey": settings.supabase_anon_key,
            "Content-Type": "application/json",
        }

    async def sign_in_password(self, email: str, password: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{self._base}/token?grant_type=password",
                json={"email": email, "password": password},
                headers=self._headers,
            )
        if r.status_code == 400:
            raise UnauthorizedError("credenciales inválidas")
        r.raise_for_status()
        return r.json()

    async def refresh(self, refresh_token: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{self._base}/token?grant_type=refresh_token",
                json={"refresh_token": refresh_token},
                headers=self._headers,
            )
        if r.status_code in (400, 401):
            raise UnauthorizedError("refresh token inválido o expirado")
        r.raise_for_status()
        return r.json()

    async def sign_out(self, access_token: str) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{self._base}/logout",
                headers={**self._headers, "Authorization": f"Bearer {access_token}"},
            )
