"""Schemas Pydantic para auth."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class RefreshRequest(BaseModel):
    refresh_token: str


class SelectEmpresaRequest(BaseModel):
    empresa_id: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    empresa_id: str | None = None
    roles: list[str] = []


class EmpresaResumen(BaseModel):
    id: str
    razon_social: str
    roles: list[str]


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(min_length=6)


class LoginResponse(BaseModel):
    """Respuesta del login.

    Si el usuario pertenece a una sola empresa, devuelve tokens listos.
    Si pertenece a varias, devuelve la lista y el frontend llama a
    /auth/select-empresa con el empresa_id elegido.
    """

    user_id: str
    email: EmailStr
    empresas: list[EmpresaResumen]
    tokens: TokenResponse | None = None  # null si tiene varias empresas y debe elegir
