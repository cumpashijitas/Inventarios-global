"""Endpoints de auth."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header

from app.core.deps import get_jwt_claims
from app.core.security import JWTClaims
from app.modules.auth.application.use_cases import AuthUseCases, get_auth_use_cases
from app.modules.auth.interfaces.schemas import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    SelectEmpresaRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    uc: AuthUseCases = Depends(get_auth_use_cases),
) -> LoginResponse:
    result = await uc.login(body.email, body.password)
    return LoginResponse(**result)


@router.post("/select-empresa", response_model=TokenResponse)
async def select_empresa(
    body: SelectEmpresaRequest,
    authorization: str | None = Header(default=None),
    uc: AuthUseCases = Depends(get_auth_use_cases),
) -> TokenResponse:
    if not authorization or not authorization.lower().startswith("bearer "):
        from app.core.exceptions import UnauthorizedError
        raise UnauthorizedError("falta header Authorization")
    token = authorization.split(" ", 1)[1].strip()
    result = await uc.select_empresa(token, body.empresa_id)
    return TokenResponse(**result)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    uc: AuthUseCases = Depends(get_auth_use_cases),
) -> TokenResponse:
    result = await uc.refresh(body.refresh_token)
    return TokenResponse(**result)


@router.post("/logout", status_code=204)
async def logout(
    authorization: str | None = Header(default=None),
    uc: AuthUseCases = Depends(get_auth_use_cases),
) -> None:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await uc.logout(token)


@router.get("/me")
async def me(claims: JWTClaims = Depends(get_jwt_claims)) -> dict:
    """Devuelve la info del usuario autenticado (útil para debug y para que el
    frontend reconstruya el estado tras un refresh)."""
    return {
        "user_id": claims.sub,
        "email": claims.email,
        "empresa_id": claims.empresa_id,
        "rol": claims.rol,
    }


@router.get("/empresa")
async def empresa_perfil(claims: JWTClaims = Depends(get_jwt_claims)) -> dict:
    """Perfil público de la empresa activa: nombre, dirección, teléfono, etc.
    Usado en recibos y cotizaciones.  Devuelve null en campos no configurados."""
    if not claims.empresa_id:
        return {}
    from app.core.database import acquire_tenant_conn
    from uuid import UUID
    async with acquire_tenant_conn(claims.empresa_id, claims.sub) as conn:
        row = await conn.fetchrow(
            "SELECT * FROM public.empresas WHERE id = $1 AND deleted_at IS NULL",
            UUID(claims.empresa_id),
        )
    if not row:
        return {}
    d = dict(row)
    return {
        "razon_social":    d.get("razon_social"),
        "nombre_comercial":d.get("nombre_comercial"),
        "nit":             d.get("nit"),
        "pais":            d.get("pais"),
        "moneda_principal":d.get("moneda_principal"),
        "logo_url":        d.get("logo_url"),
        # Opcionales — existen sólo si se corrió 10-empresa-config.sql
        "direccion":       d.get("direccion"),
        "ciudad":          d.get("ciudad"),
        "telefono":        d.get("telefono"),
        "email":           d.get("email"),
    }
