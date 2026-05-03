# Blueprint maestro — Plataforma SaaS modular de inventario

> Documento fundacional. Todo lo que construyamos después debe respetar estas decisiones o cambiarlas explícitamente aquí.
> Versión 0.1 — mayo 2026.

---

## 0. Tesis del producto

Plataforma SaaS multi-tenant que arranca con **inventario** y crece a ventas, distribución, e-commerce e IA. Vendible desde el primer cliente. Modular: cada empresa paga su plan + addons.

**No estamos construyendo:** un ERP cerrado, un sistema por cliente, ni un MVP desechable.
**Sí estamos construyendo:** un núcleo multi-tenant que escale de 1 a 1.000 empresas sin reescribirse.

Las decisiones tempranas (multi-tenant por columna, hexagonal, RLS) son caras de cambiar después. Por eso las cerramos ahora.

---

## 1. Decisiones arquitectónicas (ADR resumido)

| # | Decisión | Por qué | Alternativa rechazada |
|---|----------|---------|------------------------|
| 1 | **Monolito modular** (no microservicios) | Menos infra, menos red, menos eventual consistency. Un solo equipo no debe pagar el costo operativo de microservicios sin tráfico que lo justifique. | Microservicios desde día 1 → complejidad sin beneficio. |
| 2 | **Arquitectura hexagonal** (Ports & Adapters) por módulo | El dominio (reglas de negocio: stock, precios, comisiones) debe poder testearse sin DB ni FastAPI. Cuando llegue el momento de extraer un módulo a microservicio, el dominio ya está aislado. | MVC clásico → la lógica termina en los controllers y se vuelve intestable. |
| 3 | **Multi-tenant por columna `empresa_id`** + RLS | Una sola DB, costo lineal por empresa, fácil de respaldar y mantener. RLS de Postgres es la última línea de defensa: si el backend tiene un bug, la DB sigue aislando. | DB por cliente → operación inviable a 100+ clientes. Schema por cliente → migraciones se vuelven pesadilla. |
| 4 | **FastAPI** | Async nativo, OpenAPI gratis, Pydantic v2 para validación, ecosistema Python para IA futura. | Django → más opinionado, peor para APIs puras. Node → fragmenta el stack si después agregamos IA en Python. |
| 5 | **Supabase + Postgres** | Auth, storage, realtime y RLS sin reinventar. Postgres puro, sin lock-in fuerte. | Auth0 + RDS → más caro y más piezas que mantener al inicio. |
| 6 | **React + Vite + TS + Tailwind + shadcn/ui + Zustand** | Vite = build instantáneo. shadcn = componentes propios (no NPM lock-in). Zustand = estado global sin Redux boilerplate. | Next.js → SSR no aporta a una app de dashboard autenticado. |
| 7 | **Cloudflare Pages (frontend) + Hetzner VPS (backend)** | Pages = CDN global gratis. Hetzner = mejor €/CPU del mercado para el backend. | Vercel + AWS → 5–10× el costo sin valor a esta escala. |
| 8 | **JWT con claim `empresa_id`** propagado a Postgres | El backend pone `empresa_id` y `rol` en el JWT firmado por Supabase. Postgres lee ese claim en RLS. Una sola fuente de verdad por request. | Pasar tenant en header → fácil de spoofear. |

---

## 2. Capas del sistema

```
┌─────────────────────────────────────────────────────────┐
│ Cliente (Browser / PWA / Móvil)                         │
│ React + Vite + TS + shadcn                              │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / JSON
┌────────────────────────▼────────────────────────────────┐
│ Edge: Cloudflare Pages (estáticos) + DNS                │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Backend: FastAPI en Hetzner detrás de Nginx + TLS       │
│  ┌───────────────────────────────────────────────────┐  │
│  │ interfaces/  (HTTP, REST, schemas Pydantic)       │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ application/ (use cases, orquestación)            │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ domain/      (entidades, reglas, value objects)   │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ infrastructure/ (Supabase, repos, APIs externas)  │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ SQL + RLS
┌────────────────────────▼────────────────────────────────┐
│ Supabase: Postgres + Auth + Storage + Realtime          │
│ RLS activo en TODAS las tablas operativas               │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Estructura de carpetas — Backend

```
backend/
├── pyproject.toml          # uv o poetry
├── .env.example
├── alembic/                # migraciones (sí, aunque uses Supabase)
├── app/
│   ├── main.py             # FastAPI app, middlewares, routers
│   ├── core/
│   │   ├── config.py       # Settings con pydantic-settings
│   │   ├── security.py     # JWT, password hashing, claims
│   │   ├── database.py     # Supabase client + asyncpg pool
│   │   ├── deps.py         # Dependencias FastAPI (current_user, current_empresa)
│   │   └── exceptions.py   # AppException base + handlers
│   ├── shared/
│   │   ├── auditoria.py    # log de cambios cross-módulo
│   │   ├── permisos.py     # ¿usuario X puede acción Y?
│   │   ├── tenant.py       # context var con empresa_id por request
│   │   ├── pagination.py   # cursor + offset helpers
│   │   └── result.py       # Result[T, E] para use cases
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── domain/        # User, Session, AuthPolicy (entidades)
│   │   │   ├── application/   # LoginUseCase, RefreshTokenUseCase
│   │   │   ├── infrastructure/# SupabaseAuthAdapter, UserRepository
│   │   │   └── interfaces/    # routes.py, schemas.py
│   │   ├── empresas/
│   │   ├── inventario/
│   │   │   ├── domain/
│   │   │   │   ├── entities.py     # Producto, Almacen, Stock
│   │   │   │   ├── value_objects.py# SKU, Cantidad, Precio
│   │   │   │   └── services.py     # MovimientoStockService
│   │   │   ├── application/
│   │   │   │   ├── crear_producto.py
│   │   │   │   ├── ajustar_stock.py
│   │   │   │   └── transferir_stock.py
│   │   │   ├── infrastructure/
│   │   │   │   ├── productos_repo.py
│   │   │   │   └── stock_repo.py
│   │   │   └── interfaces/
│   │   │       ├── routes.py
│   │   │       └── schemas.py
│   │   ├── ventas/         # Fase 2
│   │   ├── compras/        # Fase 2
│   │   └── distribucion/   # Fase 3
│   └── interfaces/
│       └── api_v1.py       # Router maestro: incluye routers de cada módulo
└── tests/
    ├── unit/               # Solo dominio + use cases (sin DB)
    ├── integration/        # Con Postgres real (testcontainers)
    └── e2e/                # HTTP completo con httpx.AsyncClient
```

**Regla de oro hexagonal:** `domain/` no importa NADA de `infrastructure/` ni de `interfaces/`. Si rompes esta regla, el aislamiento muere.

---

## 4. Estructura de carpetas — Frontend

```
frontend/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json         # shadcn config
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx      # React Router con lazy loading por módulo
│   │   ├── providers.tsx   # QueryClient, Theme, Toaster, ErrorBoundary
│   │   └── layouts/
│   │       ├── AppShell.tsx        # sidebar + topbar + outlet
│   │       └── AuthLayout.tsx      # centrado, sin sidebar
│   ├── shared/
│   │   ├── api/
│   │   │   ├── client.ts           # axios/ky con interceptor JWT
│   │   │   └── error-handler.ts
│   │   ├── components/             # Button, Input, DataTable, EmptyState
│   │   ├── hooks/                  # useDebounce, useMediaQuery, useTenant
│   │   ├── lib/                    # cn, formatters (moneda, fecha)
│   │   ├── stores/                 # auth.store, tenant.store (Zustand)
│   │   └── types/                  # tipos compartidos (Empresa, Usuario, Plan)
│   └── modules/
│       ├── auth/
│       │   ├── pages/              # LoginPage, RegisterPage
│       │   ├── components/
│       │   ├── hooks/              # useLogin, useLogout
│       │   ├── services/           # authApi
│       │   └── types/
│       ├── inventario/
│       │   ├── pages/
│       │   │   ├── ProductosPage.tsx
│       │   │   ├── ProductoDetallePage.tsx
│       │   │   ├── AlmacenesPage.tsx
│       │   │   └── MovimientosPage.tsx
│       │   ├── components/
│       │   │   ├── ProductoForm.tsx
│       │   │   ├── ProductoTable.tsx
│       │   │   └── AjusteStockModal.tsx
│       │   ├── hooks/              # useProductos, useAjustarStock
│       │   ├── services/           # productosApi, stockApi
│       │   └── types/
│       └── ...
└── public/
    └── manifest.json       # PWA
```

**Regla:** un módulo del frontend no importa de otro módulo. Si necesitan algo en común, sube a `shared/`. Esto te permite cargar módulos por plan (`Plan Distribuidora` carga el chunk de `distribucion/`).

---

## 5. Modelo multi-tenant — cómo se ejecuta cada request

```
1. Cliente envía request con Authorization: Bearer <JWT>
   El JWT contiene claims: { sub: user_id, empresa_id, rol, plan_id }

2. FastAPI middleware:
   - Verifica firma del JWT (usa JWKS de Supabase)
   - Extrae claims y los pone en un ContextVar (tenant_context)
   - Inyecta SET LOCAL app.current_empresa_id = '<uuid>' en cada conexión Postgres

3. Dependency `get_current_user` valida:
   - usuario activo
   - empresa activa
   - suscripción vigente (empresa_suscripciones.estado = 'activa')
   - módulo requerido por el endpoint está habilitado para ese plan o como addon

4. Endpoint ejecuta use case
   Use case habla con repository
   Repository ejecuta SQL — Postgres aplica RLS sobre app.current_empresa_id
   Si el SQL intenta tocar otra empresa, RLS lo bloquea (devuelve 0 filas)

5. Auditoría: cada mutación se registra (quién, qué, cuándo, desde dónde)
```

**Resultado:** triple defensa.
- Capa app valida permisos (rápido, mensajes claros).
- Capa repository valida tenant (defensa en profundidad).
- Capa Postgres aplica RLS (última línea, imposible de saltar).

---

## 6. Control de acceso — el "circuito de autorización"

Cada endpoint debe declarar lo que necesita. Ejemplo:

```python
@router.post(
    "/productos",
    dependencies=[
        Depends(require_modulo("inventario")),
        Depends(require_permiso("productos.crear")),
    ],
)
async def crear_producto(...):
    ...
```

Validaciones encadenadas (de barata a cara):

```
1. ¿JWT válido?                    → 401
2. ¿Usuario activo?                → 401
3. ¿Empresa activa?                → 403
4. ¿Suscripción vigente?           → 402 Payment Required
5. ¿Plan o addon incluye módulo?   → 403 con upsell
6. ¿Rol del usuario tiene permiso? → 403
7. ¿Política de IP/dispositivo OK? → 403
8. → ejecuta use case
```

El paso 5 te da una mecánica comercial: cuando un usuario intenta usar un módulo que su plan no incluye, devuelves 403 con `{ upgrade_to: "profesional", addon: null }` y el frontend muestra modal de upgrade. Eso convierte el sistema de permisos en motor de upsell.

---

## 7. UX/UI — principios no negociables

Esto define si el sistema se siente como "software profesional 2026" o como "ERP de los 2000". Es lo que justifica que cobres más.

| Principio | Cómo se ve |
|-----------|-----------|
| Espaciado amplio | Padding base 16–24px. Nada de tablas con filas de 24px. |
| Tipografía | Inter o Geist, 14–15px base, line-height 1.5. Numérica con `tabular-nums` en tablas. |
| Color | Neutral grises (slate/zinc), 1 acento (azul), semánticos (rojo/ámbar/verde). Jamás usar 5 colores en una pantalla. |
| Densidad | Por defecto cómoda. Toggle "compacto" para power users (distribuidora). |
| Feedback | Skeleton al cargar (no spinners), toast al guardar, optimistic updates en acciones simples. |
| Errores | "No se pudo guardar el producto: el SKU ya existe en este almacén." Nunca "Error 500". |
| Atajos | `Cmd+K` global para buscar/navegar. `N` para nuevo registro en cada lista. |
| Mobile | PWA real, instalable. Sidebar colapsa a drawer. Tablas → cards. |
| Velocidad percibida | Time to interactive < 1.5s en 4G. Usar React Query con `staleTime` agresivo. |

**Anti-patrones prohibidos:** menús de 4 niveles, modales sobre modales, formularios de 30 campos sin secciones, animaciones largas, gradientes purpurina, emojis decorativos en UI productiva.

---

## 8. Stack final consolidado

**Backend**
- Python 3.12, FastAPI, uvicorn + gunicorn
- Pydantic v2 (validación + settings)
- asyncpg (driver directo) + Supabase Python client (auth y storage)
- Alembic (migraciones — sí, aunque uses Supabase: para cambios versionados)
- pytest + pytest-asyncio + testcontainers
- structlog (logs JSON estructurados)
- Sentry (errores en prod)

**Frontend**
- React 18, Vite 5, TypeScript 5
- Tailwind 3, shadcn/ui, Radix primitives
- TanStack Query (server state) + Zustand (client state)
- React Router 6
- React Hook Form + Zod
- date-fns, dinero.js (dinero NUNCA con float)
- Vitest + Testing Library + Playwright (e2e)

**Infra**
- Supabase (Postgres 15, Auth, Storage)
- Hetzner CPX21 (3 vCPU, 4GB) inicial
- Nginx + Certbot (TLS)
- Docker Compose en producción inicial; Kubernetes solo cuando duela
- Cloudflare Pages (frontend) + Cloudflare DNS + WAF
- GitHub Actions (CI/CD)
- Sentry + Better Stack (uptime + logs)

---

## 9. Convenciones de código

**Backend**
- Snake_case para todo: tablas, columnas, funciones Python.
- IDs: `uuid` (no autoincrement). Default `gen_random_uuid()`.
- Timestamps: `created_at`, `updated_at` con `timestamptz`. Trigger global `set_updated_at()`.
- Money: `numeric(14,4)` en DB, `Decimal` en Python, nunca float.
- Soft delete: columna `deleted_at timestamptz null`. Nada se borra de verdad en operativas.
- Cada tabla operativa: `id, empresa_id, ..., created_at, updated_at, created_by, updated_by, deleted_at`.

**Frontend**
- Componentes en PascalCase, hooks con prefijo `use`, archivos en kebab-case.
- Un componente por archivo. Si pasa de 200 líneas, divide.
- Server state en TanStack Query, nunca en Zustand. Zustand solo para UI state (sidebar abierto, tema, etc.).
- Formularios siempre con React Hook Form + Zod schema reutilizado del backend (genera tipos compartidos).

---

## 10. Qué viene después de este blueprint

Próximos archivos en este mismo bundle:

1. `01-schema.sql` — DDL completo: tenants, planes, módulos, suscripciones, usuarios, sesiones, seguridad, inventario base.
2. `02-rls.sql` — funciones helper + políticas RLS para cada tabla.
3. `03-seed.sql` — planes y módulos iniciales (Básico/Profesional/Distribuidora/Empresarial).
4. `04-ROADMAP.md` — fases con sprints, definición de "listo" por fase, checklist de producción.

Después de validar la base de datos en tu Supabase, la siguiente sesión genera:
- `backend/` con FastAPI + auth + módulo inventario funcional.
- `frontend/` con shell + login + módulo inventario.
