"""Pool asyncpg + helper para ejecutar queries con tenant context.

Patrón clave (multi-tenant + RLS):
    Cada operación de DB que viene del request del usuario DEBE pasar por
    `acquire_tenant_conn`. Eso adquiere una conexión del pool, ejecuta
    `SET LOCAL app.current_empresa_id = '<uuid>'` dentro de una transacción,
    y libera la conexión al terminar.

    De este modo, las RLS policies de Postgres ven el `empresa_id` correcto
    aunque el JWT no llegue a viajar a la DB (estamos usando asyncpg directo,
    no la API REST de Supabase).

    Para tareas internas (jobs, super-admin) usar `service_pool()` que NO
    setea el tenant context y permite queries multi-tenant — pero entonces
    la responsabilidad de filtrar es 100% del código.
"""

from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator
from typing import Any

import asyncpg
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

# Pools globales — inicializados en lifespan (main.py)
_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=settings.database_pool_min,
        max_size=settings.database_pool_max,
        command_timeout=30,
        server_settings={
            "application_name": settings.app_name,
            "jit": "off",  # más rápido para queries simples y predecibles
        },
    )
    log.info("db_pool_initialized", min=settings.database_pool_min, max=settings.database_pool_max)


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        log.info("db_pool_closed")


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool no inicializado. ¿Olvidaste call init_pool() en lifespan?")
    return _pool


@contextlib.asynccontextmanager
async def acquire_tenant_conn(
    empresa_id: str,
    user_id: str | None = None,
) -> AsyncIterator[asyncpg.Connection]:
    """Conexión con `app.current_empresa_id` (y opcionalmente user_id) seteado.

    Usar siempre que se atienda un request de usuario:

        async with acquire_tenant_conn(empresa_id, user_id) as conn:
            row = await conn.fetchrow("SELECT * FROM productos WHERE id = $1", pid)
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.current_empresa_id', $1, true)", empresa_id
            )
            if user_id:
                await conn.execute(
                    "SELECT set_config('app.current_user_id', $1, true)", user_id
                )
            yield conn


@contextlib.asynccontextmanager
async def service_pool() -> AsyncIterator[asyncpg.Connection]:
    """Conexión SIN tenant context. Solo para tareas internas (jobs, migraciones).

    NO usar en respuesta a un request de usuario. Si lo haces, RLS bloquea y
    no ves nada (correcto fail-safe), pero igualmente es señal de bug.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn


async def fetch_dict(conn: asyncpg.Connection, sql: str, *args: Any) -> list[dict[str, Any]]:
    """Helper: fetch + convertir cada Record a dict (más cómodo para serializar)."""
    rows = await conn.fetch(sql, *args)
    return [dict(r) for r in rows]


async def fetchrow_dict(
    conn: asyncpg.Connection, sql: str, *args: Any
) -> dict[str, Any] | None:
    row = await conn.fetchrow(sql, *args)
    return dict(row) if row else None
