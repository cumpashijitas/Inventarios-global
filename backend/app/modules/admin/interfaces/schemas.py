"""Schemas Pydantic — módulo admin (usuarios, roles, empresa)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ─── Roles ───────────────────────────────────────────────────────────────────

class RolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    codigo: str
    nombre: str
    descripcion: str | None = None
    es_sistema: bool


# ─── Usuarios ─────────────────────────────────────────────────────────────────

class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    nombre: str
    email: str
    rol_codigo: str
    rol_nombre: str
    activo: bool
    created_at: datetime


class UsuarioCreateIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    rol_codigo: str = Field(min_length=1, max_length=50)


class UsuarioUpdateIn(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=100)
    rol_codigo: str | None = Field(default=None, min_length=1, max_length=50)
    activo: bool | None = None


# ─── Empresa ──────────────────────────────────────────────────────────────────

class EmpresaConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    razon_social: str
    nombre_comercial: str | None = None
    nit: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    pais: str | None = None
    telefono: str | None = None
    email: str | None = None
    logo_url: str | None = None
    moneda_principal: str | None = None


class EmpresaConfigIn(BaseModel):
    razon_social: str | None = Field(default=None, min_length=2, max_length=200)
    nombre_comercial: str | None = Field(default=None, max_length=200)
    nit: str | None = Field(default=None, max_length=30)
    direccion: str | None = Field(default=None, max_length=300)
    ciudad: str | None = Field(default=None, max_length=100)
    pais: str | None = Field(default=None, max_length=100)
    telefono: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    moneda_principal: str | None = Field(default=None, max_length=10)


# ─── Sistema ──────────────────────────────────────────────────────────────────

class SistemaConfigOut(BaseModel):
    notificaciones_email: bool = True
    alertas_stock_bajo:   bool = True


class SistemaConfigIn(BaseModel):
    notificaciones_email: bool | None = None
    alertas_stock_bajo:   bool | None = None


# ─── IP Permitidas ────────────────────────────────────────────────────────────

class IpPermitidaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    ip: str
    descripcion: str
    created_at: datetime


class IpPermitidaIn(BaseModel):
    ip: str = Field(min_length=7, max_length=45)
    descripcion: str = Field(default="", max_length=100)
