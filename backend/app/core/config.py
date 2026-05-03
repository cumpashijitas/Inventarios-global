"""Configuración global del backend.

Una sola fuente de verdad: variables de entorno → Settings (pydantic).
Cualquier módulo que necesite config hace `from app.core.config import settings`.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    app_env: Literal["development", "staging", "production"] = "development"
    app_name: str = "Inventario SaaS API"
    app_version: str = "0.1.0"
    log_level: str = "INFO"

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # --- Supabase ---
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    jwt_algorithm: str = "HS256"
    jwt_audience: str = "authenticated"

    # --- Database ---
    database_url: str
    database_pool_min: int = 1
    database_pool_max: int = 10

    # --- Sentry ---
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.1

    # --- Seguridad ---
    admin_ip_allowlist: list[str] = Field(default_factory=list)

    @field_validator("admin_ip_allowlist", mode="before")
    @classmethod
    def _split_ips(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [ip.strip() for ip in v.split(",") if ip.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton de settings. Cacheado para no releer .env en cada import."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
