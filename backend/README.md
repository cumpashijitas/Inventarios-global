# Backend — Inventario SaaS

FastAPI + Python 3.12 + arquitectura hexagonal + multi-tenant con RLS.

## Setup local (con uv)

```bash
# 1. Instalar uv si no lo tienes
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Clonar y entrar
cd backend

# 3. Crear venv e instalar deps
uv sync

# 4. Configurar variables de entorno
cp .env.example .env
# editar .env con los valores reales de Supabase

# 5. Levantar el servidor
uv run uvicorn app.main:app --reload --port 8000

# 6. Health check
curl http://localhost:8000/health
```

OpenAPI docs interactivos en <http://localhost:8000/docs>.

## Estructura

```
backend/
├── pyproject.toml
├── .env.example
├── app/
│   ├── main.py              # entrypoint FastAPI
│   ├── core/                # config, security, db, deps, exceptions
│   ├── shared/              # tenant context, result, pagination, audit
│   ├── modules/
│   │   ├── auth/            # login/refresh vía Supabase
│   │   └── inventario/      # productos, almacenes, stock (vertical slice hexagonal)
│   └── interfaces/api_v1.py # router maestro
└── tests/
    ├── conftest.py
    └── unit/                # solo dominio (sin DB ni HTTP)
```

Cada módulo respeta hexagonal:
- `domain/` — entidades + value objects + reglas de negocio puras (sin imports de FastAPI ni asyncpg).
- `application/` — use cases que orquestan dominio + repos.
- `infrastructure/` — implementación de repos contra Postgres.
- `interfaces/` — routes FastAPI + schemas Pydantic.

## Comandos útiles

```bash
uv run pytest                              # tests
uv run pytest tests/unit -v                # solo unit
uv run ruff check .                        # lint
uv run ruff format .                       # format
uv run mypy app                            # type check
uv run uvicorn app.main:app --reload       # dev server
```
