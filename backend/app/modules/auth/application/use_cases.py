"""Use cases de auth.

Mientras no esté la Custom Access Token Hook configurada en Supabase, el JWT
emitido NO tiene `empresa_id`. Workaround: el backend hace login, busca las
empresas del usuario, y si tiene UNA SOLA, regenera/extiende el JWT con
`empresa_id`. Si tiene varias, devuelve la lista para que el usuario elija.

NOTA: regenerar el JWT requiere que firmemos con el JWT secret de Supabase.
PyJWT puede hacerlo. Esto es solo aceptable mientras configuras la hook.
La solución correcta es la hook — entonces este código se simplifica.
"""

from __future__ import annotations

import time
from typing import Any

import jwt

from app.core.config import settings
from app.core.database import service_pool
from app.core.exceptions import NotFoundError, UnauthorizedError
from app.modules.auth.infrastructure.supabase_auth import SupabaseAuthAdapter


class AuthUseCases:
    def __init__(self, supabase: SupabaseAuthAdapter | None = None) -> None:
        self.supabase = supabase or SupabaseAuthAdapter()

    async def login(self, email: str, password: str) -> dict[str, Any]:
        # 1. Auth contra Supabase
        token_response = await self.supabase.sign_in_password(email, password)
        user_id = token_response["user"]["id"]

        # 2. Buscar empresas del usuario
        async with service_pool() as conn:
            empresas = await conn.fetch(
                """
                select e.id, e.razon_social, r.codigo as rol
                  from public.usuarios_empresa ue
                  join public.empresas e on e.id = ue.empresa_id
                  join public.roles_empresa r on r.id = ue.rol_id
                 where ue.user_id = $1 and ue.activo = true and ue.deleted_at is null
                   and e.deleted_at is null and e.estado = 'activa'
                 order by e.razon_social
                """,
                user_id,
            )

        empresas_list = [
            {"id": str(e["id"]), "razon_social": e["razon_social"], "rol": e["rol"]}
            for e in empresas
        ]

        # 3. Si tiene una sola → emitir tokens con empresa_id ya inyectado
        tokens = None
        if len(empresas_list) == 1:
            tokens = self._reissue_with_empresa(
                token_response, empresas_list[0]["id"], empresas_list[0]["rol"]
            )

        return {
            "user_id": user_id,
            "email": token_response["user"]["email"],
            "empresas": empresas_list,
            "tokens": tokens,
        }

    async def select_empresa(self, current_token: str, empresa_id: str) -> dict[str, Any]:
        """Tras un login con múltiples empresas, el usuario elige una."""
        # Decodificar (sin verificar de nuevo: ya pasó por get_jwt_claims arriba)
        # En este use case asumimos que el caller ya validó.
        payload = jwt.decode(
            current_token,
            settings.supabase_jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
        )
        user_id = payload["sub"]

        async with service_pool() as conn:
            row = await conn.fetchrow(
                """
                select r.codigo as rol
                  from public.usuarios_empresa ue
                  join public.roles_empresa r on r.id = ue.rol_id
                 where ue.user_id = $1 and ue.empresa_id = $2 and ue.activo = true
                """,
                user_id,
                empresa_id,
            )
        if row is None:
            raise NotFoundError("usuario no pertenece a esa empresa")

        return self._reissue_with_empresa(
            {"access_token": current_token, "expires_in": 3600},
            empresa_id,
            row["rol"],
        )

    async def refresh(self, refresh_token: str) -> dict[str, Any]:
        new_tokens = await self.supabase.refresh(refresh_token)
        # El refresh emite un JWT vacío (sin empresa_id custom) — re-inyectar.
        # Asumimos que el frontend mantiene el empresa_id activo y lo reenvía,
        # o usar la hook de Supabase para que el refresh ya lo incluya.
        return {
            "access_token": new_tokens["access_token"],
            "refresh_token": new_tokens["refresh_token"],
            "token_type": "bearer",
            "expires_in": new_tokens.get("expires_in", 3600),
        }

    async def logout(self, access_token: str) -> None:
        await self.supabase.sign_out(access_token)

    # -------------------------------------------------------------------
    def _reissue_with_empresa(
        self, supabase_token: dict[str, Any], empresa_id: str, rol: str
    ) -> dict[str, Any]:
        """Re-firma el access_token de Supabase agregando empresa_id y rol.

        Esto es un WORKAROUND mientras no haya Custom Access Token Hook.
        Cuando la hook esté lista, eliminar este método y devolver tokens directos.
        """
        original = jwt.decode(
            supabase_token["access_token"],
            settings.supabase_jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            options={"verify_exp": False},
        )

        new_payload = {
            **original,
            "empresa_id": empresa_id,
            "rol": rol,
            "iat": int(time.time()),
            "exp": int(time.time()) + supabase_token.get("expires_in", 3600),
        }

        new_access = jwt.encode(
            new_payload,
            settings.supabase_jwt_secret,
            algorithm=settings.jwt_algorithm,
        )

        return {
            "access_token": new_access,
            "refresh_token": supabase_token.get("refresh_token", ""),
            "token_type": "bearer",
            "expires_in": supabase_token.get("expires_in", 3600),
            "empresa_id": empresa_id,
            "rol": rol,
        }


_use_cases: AuthUseCases | None = None


def get_auth_use_cases() -> AuthUseCases:
    global _use_cases
    if _use_cases is None:
        _use_cases = AuthUseCases()
    return _use_cases


# Re-export para reducir imports
__all__ = ["AuthUseCases", "get_auth_use_cases", "UnauthorizedError"]
