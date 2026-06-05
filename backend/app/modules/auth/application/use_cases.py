"""Use cases de auth.

Modelo simplificado:
    1. Login: validar password contra Supabase Auth → obtener user_id.
    2. Buscar empresas del usuario en NUESTRA DB.
    3. Si tiene 1 empresa: emitir nuestro propio JWT con empresa_id ya inyectado.
       Si tiene varias: devolver lista, el frontend llama a /auth/select-empresa.
    4. Refresh de la sesión: re-emitir JWT (validamos que el usuario sigue activo).
       Por simplicidad NO usamos los refresh tokens de Supabase — el frontend
       puede re-loguear si nuestro JWT expira.

Esto nos hace independientes del esquema de firma de Supabase (HS256/ES256/RS256).
"""

from __future__ import annotations

from typing import Any

from app.core.database import service_pool
from app.core.exceptions import NotFoundError, UnauthorizedError
from app.core.security import decode_jwt, issue_app_token
from app.modules.auth.infrastructure.supabase_auth import SupabaseAuthAdapter


class AuthUseCases:
    def __init__(self, supabase: SupabaseAuthAdapter | None = None) -> None:
        self.supabase = supabase or SupabaseAuthAdapter()

    async def login(self, email: str, password: str) -> dict[str, Any]:
        # 1. Validar password contra Supabase Auth — solo lo usamos para esto
        supabase_token = await self.supabase.sign_in_password(email, password)
        user_id = supabase_token["user"]["id"]
        user_email = supabase_token["user"].get("email")

        # 2. Empresas del usuario
        async with service_pool() as conn:
            rows = await conn.fetch(
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
            {"id": str(r["id"]), "razon_social": r["razon_social"], "rol": r["rol"]}
            for r in rows
        ]

        # 3. Si tiene una sola → emitir nuestro JWT directo
        tokens = None
        if len(empresas_list) == 1:
            tokens = self._issue_session(
                user_id=user_id,
                email=user_email,
                empresa_id=empresas_list[0]["id"],
                rol=empresas_list[0]["rol"],
            )

        return {
            "user_id": user_id,
            "email": user_email,
            "empresas": empresas_list,
            "tokens": tokens,
        }

    async def select_empresa(self, current_token: str, empresa_id: str) -> dict[str, Any]:
        """Tras un login con múltiples empresas, el usuario elige una.

        El current_token es nuestro propio JWT (sin empresa_id aún) — lo
        decodificamos para obtener el user_id, validamos que el user pertenece
        a la empresa elegida, y emitimos un JWT nuevo con empresa_id puesto.
        """
        claims = decode_jwt(current_token)

        async with service_pool() as conn:
            row = await conn.fetchrow(
                """
                select r.codigo as rol
                  from public.usuarios_empresa ue
                  join public.roles_empresa r on r.id = ue.rol_id
                 where ue.user_id = $1 and ue.empresa_id = $2 and ue.activo = true
                """,
                claims.sub,
                empresa_id,
            )
        if row is None:
            raise NotFoundError("usuario no pertenece a esa empresa")

        return self._issue_session(
            user_id=claims.sub,
            email=claims.email,
            empresa_id=empresa_id,
            rol=row["rol"],
        )

    async def refresh(self, refresh_token: str) -> dict[str, Any]:
        """Refresca la sesión validando que el usuario sigue activo en la empresa.

        En este modelo simplificado, refresh_token = el access_token actual
        (aún no expirado). Si quieres refresh tokens propios, agrega una tabla
        refresh_tokens y rotación.
        """
        try:
            claims = decode_jwt(refresh_token)
        except UnauthorizedError as e:
            raise UnauthorizedError("refresh token inválido o expirado") from e

        if not claims.empresa_id:
            raise UnauthorizedError("token sin empresa_id; vuelve a hacer login")

        async with service_pool() as conn:
            row = await conn.fetchrow(
                """
                select r.codigo as rol
                  from public.usuarios_empresa ue
                  join public.roles_empresa r on r.id = ue.rol_id
                 where ue.user_id = $1 and ue.empresa_id = $2
                   and ue.activo = true and ue.deleted_at is null
                """,
                claims.sub,
                claims.empresa_id,
            )
        if row is None:
            raise UnauthorizedError("el usuario ya no pertenece a esa empresa")

        return self._issue_session(
            user_id=claims.sub,
            email=claims.email,
            empresa_id=claims.empresa_id,
            rol=row["rol"],
        )

    async def change_password(self, user_id: str, new_password: str) -> None:
        await self.supabase.admin_update_password(user_id, new_password)

    async def logout(self, _access_token: str) -> None:
        # Como el JWT es self-contained y stateless, "logout" es responsabilidad
        # del frontend (descartar el token). Si querés revocación real, agrega
        # una tabla `tokens_revocados` y chequea en decode_jwt.
        return None

    # -------------------------------------------------------------------
    def _issue_session(
        self, *, user_id: str, email: str | None, empresa_id: str, rol: str
    ) -> dict[str, Any]:
        token, expires_in = issue_app_token(
            user_id=user_id,
            empresa_id=empresa_id,
            rol=rol,
            email=email,
        )
        return {
            "access_token": token,
            # En este modelo simple, refresh_token = access_token actual.
            # El cliente puede llamar a /auth/refresh con el access_token vivo
            # para extender la sesión.
            "refresh_token": token,
            "token_type": "bearer",
            "expires_in": expires_in,
            "empresa_id": empresa_id,
            "rol": rol,
        }


_use_cases: AuthUseCases | None = None


def get_auth_use_cases() -> AuthUseCases:
    global _use_cases
    if _use_cases is None:
        _use_cases = AuthUseCases()
    return _use_cases


__all__ = ["AuthUseCases", "get_auth_use_cases", "UnauthorizedError"]
