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
    def __init__(
        self,
        supabase_url: str | None = None,
        anon_key: str | None = None,
        service_role_key: str | None = None,
    ) -> None:
        url = (supabase_url or settings.supabase_url).rstrip("/")
        self._base = f"{url}/auth/v1"
        self._anon_key = anon_key or settings.supabase_anon_key
        self._service_key = service_role_key or getattr(settings, "supabase_service_role_key", None)
        self._headers = {
            "apikey": self._anon_key,
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

    async def create_user(self, email: str, password: str, nombre: str) -> str:
        """
        Crea un usuario en Supabase Auth usando el Admin API (service_role).
        Devuelve el user_id (UUID) del usuario creado.
        Requiere SUPABASE_SERVICE_ROLE_KEY en la configuración.
        """
        if not self._service_key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY no está configurado")

        admin_headers = {
            "apikey": self._service_key,
            "Authorization": f"Bearer {self._service_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "email": email,
            "password": password,
            "email_confirm": True,          # evita el email de confirmación
            "user_metadata": {"nombre": nombre},
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{self._base}/admin/users",
                json=payload,
                headers=admin_headers,
            )

        if r.status_code == 422:
            raise ValueError("El email ya está registrado en el sistema")
        if r.status_code == 400:
            data = r.json()
            msg = data.get("msg") or data.get("message") or "Error al crear el usuario"
            raise ValueError(msg)
        r.raise_for_status()
        return r.json()["id"]

    async def delete_user(self, auth_user_id: str) -> None:
        """Elimina un usuario de Supabase Auth (irreversible). Usar con cuidado."""
        if not self._service_key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY no está configurado")
        admin_headers = {
            "apikey": self._service_key,
            "Authorization": f"Bearer {self._service_key}",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            await client.delete(
                f"{self._base}/admin/users/{auth_user_id}",
                headers=admin_headers,
            )
