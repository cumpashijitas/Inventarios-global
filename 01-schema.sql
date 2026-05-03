-- =============================================================================
-- 01-schema.sql — Esquema base multi-tenant
-- Plataforma SaaS de inventario / ventas / operaciones
-- Postgres 15+ / Supabase
-- =============================================================================
--
-- Convenciones:
--   - Todos los IDs son UUID v4 (gen_random_uuid()).
--   - Todos los timestamps son timestamptz.
--   - Toda tabla operativa lleva empresa_id + created_at/updated_at + soft delete.
--   - Money: numeric(14,4). Cantidades: numeric(14,4). Porcentajes: numeric(7,4).
--   - Nada se borra de verdad: deleted_at IS NULL = activo.
--
-- Orden de ejecución:
--   1. Extensiones
--   2. Helpers globales (triggers de updated_at, función de tenant)
--   3. Tablas de control (planes, módulos, empresas, suscripciones)
--   4. Tablas de usuarios y seguridad
--   5. Tablas operativas — módulo inventario base
--   6. Índices secundarios
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONES
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- emails case-insensitive
create extension if not exists "pg_trgm";    -- búsqueda fuzzy en productos
create extension if not exists "btree_gin";  -- permite mezclar uuid btree con trgm en GIN


-- -----------------------------------------------------------------------------
-- 2. HELPERS GLOBALES
-- -----------------------------------------------------------------------------

-- Trigger genérico: actualiza updated_at en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Devuelve el empresa_id del request actual.
-- Se setea en cada conexión vía `SET LOCAL app.current_empresa_id = '<uuid>'`
-- desde el backend FastAPI. Si no está seteado, devuelve null y RLS bloquea.
create or replace function public.current_empresa_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_empresa_id', true), '')::uuid;
$$;

-- Devuelve el user_id del request actual.
-- El backend FastAPI debe ejecutar `SET LOCAL app.current_user_id = '<uuid>'`
-- en cada conexión. Si quieres que también haga fallback a auth.uid() en
-- Supabase, puedes envolver esta función con un coalesce desde una migración
-- posterior — pero mantenerla portable simplifica testing local y CI.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;


-- -----------------------------------------------------------------------------
-- 3. TABLAS DE CONTROL — el "panel de fábrica" del SaaS
-- Estas tablas NO llevan empresa_id porque son globales (catálogo de planes,
-- módulos disponibles). Solo el equipo interno (super-admin) las modifica.
-- -----------------------------------------------------------------------------

-- 3.1 Catálogo de planes vendibles
create table if not exists public.planes (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,           -- 'basico', 'profesional', 'distribuidora', 'empresarial'
  nombre          text not null,
  descripcion     text,
  precio_mensual  numeric(14,4) not null default 0,
  moneda          char(3) not null default 'BOB',
  orden           int not null default 0,         -- para ordenar en la pricing page
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_planes_updated_at before update on public.planes
  for each row execute function public.set_updated_at();

-- 3.2 Catálogo global de módulos disponibles en el sistema
create table if not exists public.modulos (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,            -- 'inventario', 'ventas', 'compras', 'distribucion', 'agente_ia', 'ecommerce'...
  nombre        text not null,
  descripcion   text,
  categoria     text not null default 'core',    -- 'core' | 'addon' | 'integracion'
  precio_addon  numeric(14,4) default 0,         -- precio si se contrata como addon suelto
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_modulos_updated_at before update on public.modulos
  for each row execute function public.set_updated_at();

-- 3.3 Qué módulos incluye cada plan por defecto
create table if not exists public.plan_modulos (
  plan_id    uuid not null references public.planes(id) on delete cascade,
  modulo_id  uuid not null references public.modulos(id) on delete cascade,
  primary key (plan_id, modulo_id)
);


-- -----------------------------------------------------------------------------
-- 4. EMPRESAS (TENANTS) y suscripciones
-- -----------------------------------------------------------------------------

-- 4.1 La empresa cliente. Esto es el TENANT.
create table if not exists public.empresas (
  id                uuid primary key default gen_random_uuid(),
  razon_social      text not null,
  nombre_comercial  text,
  nit               text,                          -- NIT/RUC/Tax ID
  pais              char(2) not null default 'BO',
  zona_horaria      text not null default 'America/La_Paz',
  moneda_principal  char(3) not null default 'BOB',
  logo_url          text,
  estado            text not null default 'activa',-- 'activa' | 'suspendida' | 'cerrada'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create trigger trg_empresas_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();

-- 4.2 Suscripción vigente de cada empresa (una activa a la vez).
-- Histórico se guarda en empresa_suscripciones_historial (creable después).
create table if not exists public.empresa_suscripciones (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  plan_id             uuid not null references public.planes(id),
  estado              text not null default 'activa',  -- 'trial' | 'activa' | 'pausada' | 'cancelada' | 'morosa'
  inicio              date not null default current_date,
  fin                 date,                            -- null = renovación automática
  precio_pactado      numeric(14,4) not null,          -- snapshot al momento de contratar
  moneda              char(3) not null default 'BOB',
  ciclo_facturacion   text not null default 'mensual', -- 'mensual' | 'anual'
  proxima_facturacion date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index ux_empresa_suscripcion_activa
  on public.empresa_suscripciones (empresa_id)
  where estado in ('trial','activa','morosa');
create trigger trg_empresa_suscripciones_updated_at before update on public.empresa_suscripciones
  for each row execute function public.set_updated_at();

-- 4.3 Addons contratados sueltos (módulos fuera del plan base).
create table if not exists public.empresa_modulos_extra (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  modulo_id     uuid not null references public.modulos(id),
  precio_pactado numeric(14,4) not null default 0,
  activo        boolean not null default true,
  inicio        date not null default current_date,
  fin           date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (empresa_id, modulo_id)
);
create trigger trg_empresa_modulos_extra_updated_at before update on public.empresa_modulos_extra
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 5. USUARIOS, ROLES, SEGURIDAD POR EMPRESA
-- Supabase ya gestiona auth.users (email, password, MFA). Aquí solo extendemos
-- con el "perfil empresarial": qué empresa, qué rol, qué permisos extra.
-- -----------------------------------------------------------------------------

-- 5.1 Roles definidos por empresa (cada empresa puede customizarlos).
create table if not exists public.roles_empresa (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  codigo       text not null,                   -- 'admin', 'vendedor', 'almacenero', 'contador'
  nombre       text not null,
  descripcion  text,
  permisos     jsonb not null default '[]'::jsonb, -- ['productos.crear','ventas.ver',...]
  es_sistema   boolean not null default false,  -- true = no se puede borrar (admin base)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (empresa_id, codigo)
);
create trigger trg_roles_empresa_updated_at before update on public.roles_empresa
  for each row execute function public.set_updated_at();

-- 5.2 Vínculo usuario↔empresa. Un usuario PUEDE pertenecer a varias empresas
-- (típico de contadores externos). El selector de empresa al login define el
-- empresa_id activo para esa sesión.
create table if not exists public.usuarios_empresa (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  user_id      uuid not null,                   -- referencia a auth.users(id)
  rol_id       uuid not null references public.roles_empresa(id),
  nombre       text not null,
  email        citext not null,
  telefono     text,
  activo       boolean not null default true,
  invitado_por uuid,                            -- user_id del que invitó
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (empresa_id, user_id)
);
create index ix_usuarios_empresa_user on public.usuarios_empresa(user_id);
create trigger trg_usuarios_empresa_updated_at before update on public.usuarios_empresa
  for each row execute function public.set_updated_at();

-- 5.3 Política de acceso por empresa (se evalúa antes de cada login).
create table if not exists public.empresa_politicas_acceso (
  empresa_id              uuid primary key references public.empresas(id) on delete cascade,
  exigir_mfa              boolean not null default false,
  permitir_solo_dispositivos_autorizados boolean not null default false,
  permitir_solo_ips_listadas boolean not null default false,
  duracion_sesion_min     int not null default 480,  -- 8h
  reintentos_max_login    int not null default 5,
  bloqueo_minutos         int not null default 15,
  updated_at              timestamptz not null default now()
);
create trigger trg_politicas_updated_at before update on public.empresa_politicas_acceso
  for each row execute function public.set_updated_at();

-- 5.4 Dispositivos autorizados (huella + nombre).
create table if not exists public.dispositivos_autorizados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  user_id         uuid not null,
  device_hash     text not null,                  -- hash de fingerprint del cliente
  nombre          text,                           -- "Laptop María", "iPhone Juan"
  ultimo_uso      timestamptz,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (empresa_id, user_id, device_hash)
);

-- 5.5 IPs/CIDRs permitidos por empresa (opcional).
create table if not exists public.empresa_ips_permitidas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  cidr        cidr not null,
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 5.6 Sesiones activas (auditoría + revocación).
create table if not exists public.sesiones_usuario (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  user_id         uuid not null,
  ip              inet,
  user_agent      text,
  device_hash     text,
  iniciada_en     timestamptz not null default now(),
  expira_en       timestamptz not null,
  revocada_en     timestamptz,
  revocada_por    uuid,
  motivo_revoc    text
);
create index ix_sesiones_user on public.sesiones_usuario(user_id);
create index ix_sesiones_empresa on public.sesiones_usuario(empresa_id);


-- -----------------------------------------------------------------------------
-- 6. AUDITORÍA TRANSVERSAL
-- Un solo log para mutaciones críticas. Cada módulo escribe aquí.
-- -----------------------------------------------------------------------------
create table if not exists public.auditoria (
  id            bigserial primary key,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  user_id       uuid,
  modulo        text not null,                  -- 'inventario', 'ventas', etc.
  entidad       text not null,                  -- 'producto', 'movimiento_stock'
  entidad_id    uuid,
  accion        text not null,                  -- 'crear', 'actualizar', 'eliminar', 'ajustar'
  payload_antes jsonb,
  payload_despues jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index ix_auditoria_empresa_fecha on public.auditoria(empresa_id, created_at desc);
create index ix_auditoria_entidad on public.auditoria(empresa_id, entidad, entidad_id);


-- -----------------------------------------------------------------------------
-- 7. MÓDULO INVENTARIO — esquema base
-- -----------------------------------------------------------------------------

-- 7.1 Almacenes (sucursales / depósitos / vehículos para distribuidoras).
create table if not exists public.almacenes (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  codigo       text not null,                    -- 'CENTRAL', 'SUC-LP', 'CAMION-01'
  nombre       text not null,
  tipo         text not null default 'fisico',   -- 'fisico' | 'movil' | 'consigna'
  direccion    text,
  ciudad       text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz,
  unique (empresa_id, codigo)
);
create trigger trg_almacenes_updated_at before update on public.almacenes
  for each row execute function public.set_updated_at();

-- 7.2 Categorías de productos (jerárquicas con parent_id).
create table if not exists public.categorias (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  parent_id    uuid references public.categorias(id) on delete set null,
  nombre       text not null,
  orden        int not null default 0,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index ix_categorias_empresa on public.categorias(empresa_id);
create trigger trg_categorias_updated_at before update on public.categorias
  for each row execute function public.set_updated_at();

-- 7.3 Unidades de medida (UN, KG, LT, CAJA).
create table if not exists public.unidades_medida (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  codigo       text not null,
  nombre       text not null,
  decimales    int not null default 0,           -- KG admite decimales, UN no
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (empresa_id, codigo)
);
create trigger trg_unidades_updated_at before update on public.unidades_medida
  for each row execute function public.set_updated_at();

-- 7.4 Productos (master data).
create table if not exists public.productos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  sku             text not null,
  codigo_barras   text,
  nombre          text not null,
  descripcion     text,
  categoria_id    uuid references public.categorias(id) on delete set null,
  unidad_id       uuid not null references public.unidades_medida(id),
  precio_compra   numeric(14,4) not null default 0,
  precio_venta    numeric(14,4) not null default 0,
  stock_minimo    numeric(14,4) not null default 0,
  stock_maximo    numeric(14,4),
  controla_stock  boolean not null default true,  -- false = servicios
  activo          boolean not null default true,
  imagen_url      text,
  metadatos       jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz,
  unique (empresa_id, sku)
);
create index ix_productos_empresa_nombre on public.productos
  using gin (empresa_id, nombre gin_trgm_ops);   -- búsqueda fuzzy
create index ix_productos_codigo_barras on public.productos(empresa_id, codigo_barras);
create trigger trg_productos_updated_at before update on public.productos
  for each row execute function public.set_updated_at();

-- 7.5 Stock por (producto, almacén). Una fila por combinación.
-- Esta tabla se actualiza SOLO vía movimientos_stock (nunca UPDATE directo
-- desde la app: las mutaciones pasan por la función registrar_movimiento).
create table if not exists public.stock_actual (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  producto_id   uuid not null references public.productos(id) on delete cascade,
  almacen_id    uuid not null references public.almacenes(id) on delete cascade,
  cantidad      numeric(14,4) not null default 0,
  costo_promedio numeric(14,4) not null default 0,
  updated_at    timestamptz not null default now(),
  unique (empresa_id, producto_id, almacen_id)
);
create index ix_stock_actual_empresa_producto on public.stock_actual(empresa_id, producto_id);
create trigger trg_stock_actual_updated_at before update on public.stock_actual
  for each row execute function public.set_updated_at();

-- 7.6 Movimientos de stock (ledger inmutable — append only).
-- Cada entrada/salida/ajuste/transferencia escribe aquí. La verdad histórica
-- vive aquí; stock_actual es solo el snapshot calculado.
create table if not exists public.movimientos_stock (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  almacen_id      uuid not null references public.almacenes(id),
  tipo            text not null,                  -- 'entrada' | 'salida' | 'ajuste' | 'transferencia_in' | 'transferencia_out'
  cantidad        numeric(14,4) not null,         -- siempre positiva; el tipo define dirección
  costo_unitario  numeric(14,4) not null default 0,
  referencia_tipo text,                           -- 'compra', 'venta', 'ajuste_manual', 'transferencia'
  referencia_id   uuid,                           -- id del documento origen
  motivo          text,
  user_id         uuid,
  created_at      timestamptz not null default now()
);
create index ix_movimientos_empresa_fecha on public.movimientos_stock(empresa_id, created_at desc);
create index ix_movimientos_producto on public.movimientos_stock(empresa_id, producto_id, created_at desc);

-- =============================================================================
-- FIN DEL SCHEMA BASE
-- Siguiente paso: aplicar 02-rls.sql para activar Row Level Security.
-- =============================================================================
