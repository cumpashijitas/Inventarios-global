"""Entrypoint FastAPI.

Responsabilidades:
    - Configurar logging estructurado (structlog)
    - Inicializar Sentry (si SENTRY_DSN está seteado)
    - Crear el pool de DB en startup, cerrarlo en shutdown
    - Registrar middlewares globales (CORS, request_id, error handler)
    - Montar el router de API v1
    - Exponer /health para uptime monitoring
"""

from __future__ import annotations

import logging
import sys
import uuid
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse

from app.core.config import settings
from app.core.database import close_pool, get_pool, init_pool
from app.core.exceptions import AppError
from app.interfaces.api_v1 import api_v1


# -----------------------------------------------------------------------------
# Logging estructurado
# -----------------------------------------------------------------------------
def configure_logging() -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=settings.log_level,
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


log = structlog.get_logger("app.main")


# -----------------------------------------------------------------------------
# Sentry
# -----------------------------------------------------------------------------
def configure_sentry() -> None:
    if not settings.sentry_dsn:
        return
    import sentry_sdk
    from sentry_sdk.integrations.asyncio import AsyncioIntegration
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        release=settings.app_version,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[FastApiIntegration(), AsyncioIntegration()],
    )


# -----------------------------------------------------------------------------
# Lifespan: startup / shutdown
# -----------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    configure_sentry()
    await init_pool()
    log.info("app_started", env=settings.app_env, version=settings.app_version)
    yield
    await close_pool()
    log.info("app_stopped")


# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

# -----------------------------------------------------------------------------
# CORS
#
# - En desarrollo: cualquier localhost/127.0.0.1 con cualquier puerto pasa
#   (Vite a veces serve en 5173, a veces en 5174 si 5173 está ocupado, etc.).
#   Usamos allow_origin_regex porque allow_origins=["*"] no es compatible con
#   allow_credentials=True (regla CORS).
# - En producción: lista explícita desde CORS_ORIGINS env var.
#
# IMPORTANTE: el preflight OPTIONS lo responde este middleware DIRECTO; no
# llega al endpoint. Si ves 400 en OPTIONS, es porque el origin/método/header
# pedido NO está en la lista permitida. La regex de abajo cubre dev al 100%.
# -----------------------------------------------------------------------------
if settings.is_production:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )


# -----------------------------------------------------------------------------
# Middleware: request_id + structured logging por request
#
# OJO: atrapamos cualquier excepción aquí y la convertimos a JSONResponse 500
# para que el CORSMiddleware (que está afuera) pueda agregar sus headers a la
# respuesta. Si dejas que la excepción burbujee, Starlette responde 500 desde
# fuera del stack de middlewares y los headers CORS se pierden — el browser
# bloquea con "No 'Access-Control-Allow-Origin' header is present".
# -----------------------------------------------------------------------------
@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001
        log.exception("unhandled_error", error=str(exc))
        response = JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "Error interno del servidor",
                    "details": {"type": exc.__class__.__name__},
                }
            },
        )
    response.headers["X-Request-ID"] = request_id
    return response


# -----------------------------------------------------------------------------
# Exception handler global: AppError → JSON consistente
# -----------------------------------------------------------------------------
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    log.warning(
        "app_error",
        code=exc.code,
        status=exc.status_code,
        message=exc.message,
        details=exc.details,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


# -----------------------------------------------------------------------------
# Endpoints raíz
# -----------------------------------------------------------------------------
@app.api_route("/health", methods=["GET", "HEAD"], tags=["meta"])
async def health() -> dict[str, Any]:
    """Healthcheck: valida que la DB responde."""
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("select 1")
        db_ok = True
    except Exception as e:  # noqa: BLE001
        log.error("healthcheck_db_failed", error=str(e))
        db_ok = False

    return {
        "ok": db_ok,
        "service": settings.app_name,
        "version": settings.app_version,
        "env": settings.app_env,
        "db": db_ok,
    }


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": settings.app_name, "docs": "/docs", "health": "/health"}


# Montar API v1
app.include_router(api_v1)
