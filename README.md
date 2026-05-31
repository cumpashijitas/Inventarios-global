# Kairos — Sistema de Gestión para Tiendas de Repuestos

Sistema SaaS multi-tenant para gestión de inventario, ventas y operaciones.  
Desarrollado por **AEGIS TECH**.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Backend | FastAPI (Python 3.12) + asyncpg |
| Base de datos | PostgreSQL (Supabase) |
| Autenticación | Supabase Auth + JWT |
| Deploy frontend | Vercel |
| Deploy backend | Render |
| Monitoreo | UptimeRobot |
| Email | Resend |

---

## Requisitos previos

- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (gestor de paquetes Python)
- Cuenta en [Supabase](https://supabase.com)
- Git

---

## 1. Configurar la Base de Datos (Supabase)

Crear un proyecto en Supabase y ejecutar los scripts SQL en el **SQL Editor** en este orden exacto:

| Orden | Archivo | Qué hace |
|-------|---------|----------|
| 1 | `sql/01-schema.sql` | Crea todas las tablas del sistema |
| 2 | `sql/02-rls.sql` | Políticas de seguridad base |
| 3 | `sql/02b-rls-supabase-patch.sql` | Parche obligatorio para Supabase |
| 4 | `sql/03-seed.sql` | Datos iniciales: planes y módulos |
| 5 | `sql/04-schema-extension.sql` | Extensiones del schema |
| 6 | `sql/05-rls-extension.sql` | Extensiones de políticas RLS |
| 7 | `sql/06-seed-extension.sql` | Seed extendido |
| 8 | `sql/10-empresa-config.sql` | Configuración de empresa |
| 9 | `sql/11-caja-modulo.sql` | Módulo de caja |
| 10 | `sql/12-reportes-modulo.sql` | Módulo de reportes |
| 11 | `sql/13-fix-confirmar-lote.sql` | Fix función de confirmación de lotes |
| 12 | `sql/14-sistema-config.sql` | Configuración del sistema |
| 13 | `sql/15-ip-permitidas.sql` | Tabla de IPs autorizadas |

> Los scripts `07`, `08`, `09` son opcionales — contienen datos de prueba para desarrollo.

### Configurar el primer usuario administrador

Después de ejecutar los scripts, registrar el primer usuario en Supabase Auth y ejecutar:

```sql
-- Reemplazar los valores con los datos reales
SELECT public.bootstrap_primer_usuario(
  'email@ejemplo.com',     -- email del admin
  'Nombre Apellido',       -- nombre
  'UUID-del-usuario'       -- UUID de Supabase Auth
);
```

El script `sql/99-bootstrap-primer-usuario.sql` contiene la función completa.

---

## 2. Configurar el Backend

### Clonar e instalar dependencias

```bash
cd backend
uv sync
```

### Variables de entorno

Copiar el archivo de ejemplo y completar los valores:

```bash
cp .env.example .env
```

Completar el `.env` con los valores del proyecto Supabase:

```env
# App
APP_ENV=development
APP_NAME="Kairos API"
APP_VERSION=1.0.0
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173

# Supabase — Project Settings → API
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=tu-jwt-secret

# JWT propio del sistema
# Generar con: python -c "import secrets; print(secrets.token_urlsafe(64))"
APP_JWT_SECRET=
JWT_ALGORITHM=HS256
JWT_AUDIENCE=inventario-saas
JWT_EXPIRES_MINUTES=480

# Base de datos — Supabase → Project Settings → Database → Connection string
# Usar Session pooler (puerto 5432), no Transaction pooler
DATABASE_URL=postgresql://postgres.xxxx:password@aws-x-us-east-x.pooler.supabase.com:5432/postgres
DATABASE_POOL_MIN=1
DATABASE_POOL_MAX=10

# Email (opcional)
RESEND_API_KEY=
```

### Correr el backend

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

El backend queda disponible en `http://localhost:8000`.  
Documentación interactiva: `http://localhost:8000/docs`

---

## 3. Configurar el Frontend

### Instalar dependencias

```bash
cd frontend
npm install
```

### Variables de entorno

Crear el archivo `.env.local` en la carpeta `frontend/`:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

En producción este valor apunta a la URL del backend en Render.

### Correr el frontend

```bash
cd frontend
npm run dev
```

El frontend queda disponible en `http://localhost:5173`.

---

## 4. Orden de arranque

Siempre arrancar en este orden:

```
1. Base de datos → ya está corriendo en Supabase (no requiere acción)
2. Backend       → uv run uvicorn app.main:app --reload
3. Frontend      → npm run dev
```

---

## 5. Estructura del proyecto

```
Inventarios-global/
├── backend/                  ← FastAPI (Python)
│   ├── app/
│   │   ├── core/             ← Config, DB, seguridad, dependencias
│   │   ├── interfaces/       ← Router maestro API v1
│   │   └── modules/          ← Módulos del negocio
│   │       ├── auth/
│   │       ├── admin/
│   │       ├── inventario/
│   │       ├── ventas/
│   │       ├── caja/
│   │       ├── lotes/
│   │       ├── dashboard/
│   │       └── reportes/
│   ├── .env.example
│   ├── pyproject.toml
│   └── Procfile              ← Comando de arranque para Render
│
├── frontend/                 ← React + Vite (TypeScript)
│   ├── src/
│   │   ├── app/              ← Router, layouts
│   │   ├── modules/          ← Módulos del negocio (espejo del backend)
│   │   └── shared/           ← Componentes, hooks y utilidades compartidas
│   └── package.json
│
└── sql/                      ← Scripts de base de datos (ejecutar en orden)
```

Cada módulo del backend sigue arquitectura hexagonal con 3 capas:

```
módulo/
├── interfaces/   ← Endpoints HTTP + validación de datos
├── application/  ← Lógica del negocio (casos de uso)
└── infrastructure/ ← Queries a la base de datos
```

---

## 6. Deploy en producción

### Backend → Render

1. Crear un nuevo **Web Service** en [render.com](https://render.com)
2. Conectar el repositorio GitHub
3. Configurar:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install uv && uv sync --frozen`
   - **Start Command:** `.venv/bin/gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --workers 1 --bind 0.0.0.0:$PORT --timeout 120`
   - **Python Version:** `3.12.9` (variable de entorno `PYTHON_VERSION`)
4. Agregar todas las variables de entorno del `.env` con valores de producción
5. En `CORS_ORIGINS` poner la URL del frontend en Vercel

### Frontend → Vercel

1. Importar el repositorio en [vercel.com](https://vercel.com)
2. Configurar:
   - **Root Directory:** `frontend`
   - **Build Command:** `npx vite build`
   - **Output Directory:** `dist`
3. Agregar variable de entorno:
   - `VITE_API_URL` = URL del backend en Render + `/api/v1`

### Keep-alive → UptimeRobot

Para evitar que Render duerma el servidor en el plan gratuito:

1. Crear cuenta en [uptimerobot.com](https://uptimerobot.com)
2. Agregar monitor HTTP(s) cada 5 minutos apuntando a:
   ```
   https://tu-backend.onrender.com/health
   ```

---

## 7. Seguridad

El sistema implementa 3 capas de seguridad:

1. **JWT** — token de sesión de 8 horas, verificado en cada request
2. **Roles** — 4 roles con permisos específicos (Admin, Vendedor, Enc. Inventario, Cajero)
3. **RLS** — Row Level Security en PostgreSQL garantiza aislamiento total entre empresas

Adicionalmente, el sistema soporta **restricción por red WiFi**: el administrador puede registrar IPs autorizadas desde Configuración → Control de Acceso. Los empleados solo pueden acceder desde esas redes.

---

## 8. Módulos disponibles

| Módulo | Descripción |
|--------|-------------|
| **Auth** | Login, selección de empresa, gestión de sesión |
| **Dashboard** | Resumen del negocio en tiempo real |
| **Inventario** | Productos, proveedores, clientes y categorías |
| **Ventas** | Registro de ventas y cotizaciones |
| **Caja** | Control de sesiones de caja y movimientos |
| **Carga Masiva** | Importación de stock desde PDF, Excel o CSV |
| **Reportes** | Reportes de inventario, ventas y movimientos |
| **Administración** | Usuarios, roles, configuración e IPs autorizadas |
