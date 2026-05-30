# Backend — Módulos y Endpoints

## Arquitectura

Hexagonal por módulo: `domain → application → infrastructure → interfaces`

```
backend/app/modules/
├── auth/           ← Login, refresh, JWT
├── inventario/     ← Productos, almacenes, stock, proveedores, clientes
├── ventas/         ← Ventas, cotizaciones
├── caja/           ← Sesiones de caja, movimientos
├── lotes/          ← Carga masiva (lotes de compra + items)
├── reportes/       ← Queries agregadas (ventas, inventario, movimientos)
└── dashboard/      ← Stats en tiempo real para el dashboard
```

## Configuración de Base de Datos

Ejecutar en Supabase en este orden:

```bash
01-schema.sql            # Tablas base (empresas, productos, stock, etc.)
02-rls.sql               # RLS + función registrar_movimiento_stock
02b-rls-supabase-patch.sql  # Parches específicos de Supabase
03-seed.sql              # Planes, módulos, empresa demo
04-schema-extension.sql  # Nuevas tablas (proveedores, clientes, ventas, caja, lotes)
05-rls-extension.sql     # RLS para tablas nuevas
06-seed-extension.sql    # Datos de ejemplo (proveedores, clientes, productos con nuevos campos)
99-bootstrap-primer-usuario.sql  # Primer usuario admin
```

## Endpoints disponibles

### Auth — `/api/v1/auth`
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/login` | Login con email/password → JWT |
| POST | `/select-empresa` | Seleccionar empresa activa → JWT con empresa_id |
| POST | `/refresh` | Renovar token |
| POST | `/logout` | Invalidar sesión |
| GET | `/me` | Info del usuario actual |

### Dashboard — `/api/v1/dashboard`
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/stats` | Stats del día (ventas, órdenes, productos, stock_bajo) |

### Inventario — `/api/v1/inventario`
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/productos` | Listar productos (paginado, búsqueda) |
| POST | `/productos` | Crear producto (con marca, precios, medidas, etc.) |
| GET | `/productos/{id}` | Obtener producto |
| PATCH | `/productos/{id}` | Actualizar producto |
| DELETE | `/productos/{id}` | Soft-delete producto |
| GET | `/almacenes` | Listar almacenes |
| POST | `/almacenes` | Crear almacén |
| GET | `/stock/{producto_id}` | Stock por producto y almacén |
| POST | `/movimientos` | Ajuste manual de stock |
| GET | `/movimientos` | Listar movimientos de stock |
| GET | `/proveedores` | Listar proveedores |
| POST | `/proveedores` | Crear proveedor |
| GET | `/proveedores/{id}` | Obtener proveedor |
| PATCH | `/proveedores/{id}` | Actualizar proveedor |
| DELETE | `/proveedores/{id}` | Eliminar proveedor |
| GET | `/clientes` | Listar clientes |
| POST | `/clientes` | Crear cliente |
| GET | `/clientes/{id}` | Obtener cliente |
| PATCH | `/clientes/{id}` | Actualizar cliente |
| DELETE | `/clientes/{id}` | Eliminar cliente |

### Ventas — `/api/v1/ventas`
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `` | Listar ventas (paginado, filtro estado) |
| POST | `` | Crear venta (descuenta stock automáticamente) |
| GET | `/{id}` | Obtener venta con ítems |
| POST | `/{id}/anular` | Anular venta (devuelve stock) |
| GET | `/cotizaciones` | Listar cotizaciones |
| POST | `/cotizaciones` | Crear cotización |
| GET | `/cotizaciones/{id}` | Obtener cotización con ítems |
| PATCH | `/cotizaciones/{id}/estado` | Cambiar estado de cotización |

### Caja — `/api/v1/caja`
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/estado` | Estado de la caja actualmente abierta |
| POST | `/abrir` | Abrir sesión de caja con saldo inicial |
| POST | `/cerrar/{sesion_id}` | Cerrar caja con saldo final |
| POST | `/movimiento` | Registrar ingreso o retiro manual |
| GET | `/movimientos` | Movimientos de la sesión actual |

### Lotes (Carga Masiva) — `/api/v1/lotes`
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `` | Listar lotes de compra |
| POST | `` | Crear nuevo lote |
| GET | `/{id}` | Obtener lote con todos sus ítems |
| PUT | `/{id}/items` | Guardar/reemplazar ítems del lote (planilla completa) |
| POST | `/{id}/confirmar` | Confirmar lote → crea/actualiza productos + entradas stock |
| DELETE | `/{id}` | Eliminar lote (soft-delete) |
| POST | `/parse-archivo` | Subir PDF/Excel para extracción automática (placeholder) |

### Reportes — `/api/v1/reportes`
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/ventas?desde=&hasta=` | Resumen de ventas del periodo |
| GET | `/inventario` | Snapshot del inventario |
| GET | `/movimientos?desde=&hasta=` | Movimientos de stock del periodo |
| GET | `/export?formato=pdf&desde=&hasta=` | Exportar reporte (placeholder) |

## Campos nuevos en Productos

La tabla `public.productos` ahora incluye:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `marca` | text | Marca del producto |
| `precio_mecanico` | numeric | Precio especial para mecánicos |
| `precio_mayor` | numeric | Precio mayorista |
| `proveedor_id` | uuid | FK a `proveedores` |
| `aplicacion` | text | Compatibilidad técnica (ej: "Motor 1.8L / 2.0L") |
| `medidas` | text | Dimensiones (ej: "Ø65mm H:75mm") |
| `peso` | numeric | Peso en kg |
| `modelos` | text | Modelos de vehículo compatibles |
| `anio_desde` | smallint | Año inicial de compatibilidad |
| `anio_hasta` | smallint | Año final de compatibilidad |
| `ubicacion` | text | Ubicación física en almacén |

## Mapeo Frontend ↔ Backend

| Frontend (camelCase) | Backend (snake_case) |
|---------------------|---------------------|
| `precioReal` | `precio_compra` |
| `precioUnitario` | `precio_venta` |
| `precioMecanico` | `precio_mecanico` |
| `precioMayor` | `precio_mayor` |
| `anioDesde` | `anio_desde` |
| `anioHasta` | `anio_hasta` |

## Multi-tenancy y RLS

Todas las operaciones de usuario pasan por `acquire_tenant_conn(empresa_id, user_id)` que ejecuta:
```sql
SET LOCAL app.current_empresa_id = '<uuid>'
SET LOCAL app.current_user_id = '<uuid>'
```
Las políticas RLS en Postgres filtran automáticamente por `public.current_empresa_id()`.

## Auditoría

Cada mutación (create/update/delete) llama a `registrar_auditoria()` con payload `antes/después` en JSONB. La tabla `public.auditoria` es append-only (sin RLS de UPDATE/DELETE).
