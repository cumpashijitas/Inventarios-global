"""Endpoints de auth."""

from __future__ import annotations

from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.database import acquire_tenant_conn
from app.core.deps import get_jwt_claims
from app.core.security import JWTClaims
from app.modules.auth.application.use_cases import AuthUseCases, get_auth_use_cases
from app.modules.auth.interfaces.schemas import (
    ChangePasswordRequest,
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


@router.post("/change-password", status_code=204)
async def change_password(
    body: ChangePasswordRequest,
    claims: JWTClaims = Depends(get_jwt_claims),
    uc: AuthUseCases = Depends(get_auth_use_cases),
) -> None:
    await uc.change_password(claims.sub, body.new_password)


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
    foto_url = None
    if claims.empresa_id:
        async with acquire_tenant_conn(claims.empresa_id, claims.sub) as conn:
            foto_url = await conn.fetchval(
                "select foto_url from public.usuarios_empresa"
                " where empresa_id = $1 and user_id = $2",
                UUID(claims.empresa_id), UUID(claims.sub),
            )
    return {
        "user_id": claims.sub,
        "email": claims.email,
        "empresa_id": claims.empresa_id,
        "rol": claims.rol,
        "foto_url": foto_url,
    }


@router.post("/me/foto")
async def subir_mi_foto(
    file: UploadFile = File(...),
    claims: JWTClaims = Depends(get_jwt_claims),
) -> dict:
    """Sube la foto de perfil del usuario autenticado a Supabase Storage y
    actualiza usuarios_empresa.foto_url. Cada usuario solo puede subir la suya."""
    if not claims.empresa_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sin empresa activa")

    BUCKET = "usuarios"
    MAX_BYTES = 5 * 1024 * 1024  # 5 MB

    _ct_map = {"image/jpg": "image/jpeg"}
    ct_raw = (file.content_type or "").lower().split(";")[0].strip()
    ct = _ct_map.get(ct_raw, ct_raw)

    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if ct not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo no permitido: '{ct}'. Soportados: JPEG, PNG, WEBP, GIF.",
        )

    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen no puede superar 5 MB.",
        )

    _ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    ext = _ext_map.get(ct, ".jpg")
    storage_path = f"{claims.empresa_id}/{claims.sub}{ext}"
    object_url = f"{settings.supabase_url}/storage/v1/object/{BUCKET}/{storage_path}"
    public_url  = f"{settings.supabase_url}/storage/v1/object/public/{BUCKET}/{storage_path}"

    svc_headers = {"Authorization": f"Bearer {settings.supabase_service_role_key}"}

    async with httpx.AsyncClient(timeout=30) as http:
        await http.post(
            f"{settings.supabase_url}/storage/v1/bucket",
            json={"id": BUCKET, "name": BUCKET, "public": True},
            headers={**svc_headers, "Content-Type": "application/json"},
        )
        resp = await http.post(
            object_url,
            content=content,
            headers={
                **svc_headers,
                "Content-Type": ct,
                "x-upsert": "true",
                "Cache-Control": "3600",
            },
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase Storage respondió {resp.status_code}: {resp.text}",
        )

    async with acquire_tenant_conn(claims.empresa_id, claims.sub) as conn:
        await conn.execute(
            "update public.usuarios_empresa set foto_url = $1, updated_at = now()"
            " where empresa_id = $2 and user_id = $3",
            public_url, UUID(claims.empresa_id), UUID(claims.sub),
        )

    return {"foto_url": public_url}


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
