-- =============================================================================
-- 02-rls.sql — Row Level Security
-- Aísla los datos de cada empresa a nivel Postgres.
-- Aunque el backend tenga un bug, la DB sigue separando los tenants.
-- =============================================================================
--
-- Modelo:
--   1. Backend FastAPI, en cada request, ejecuta:
--        SET LOCAL app.current_empresa_id = '<uuid_de_la_empresa>';
--        SET LOCAL app.current_user_id    = '<uuid_del_usuario>';
--      ANTES de cualquier query.
--   2. Las políticas leen public.current_empresa_id() para filtrar.
--   3. Si la conexión no setea el contexto → 0 filas visibles.
--
-- Importante:
--   - La conexión del backend usa un rol 'app_user' SIN superuser y SIN bypass RLS.
--   - El service-role de Supabase (usado solo en jobs internos) sí puede
--     bypassear RLS — úsalo con cuidado (auditoría, migraciones, super-admin).
--   - Las tablas globales (planes, módulos, plan_modulos) tienen RLS de SOLO
--     LECTURA para todos los tenants, escritura solo desde el rol service.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ROL DE APLICACIÓN
-- Si ya usas el rol 'authenticated' de Supabase, puedes saltarte esta parte
-- y reemplazar 'app_user' por 'authenticated' en las políticas de abajo.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end$$;

grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
alter default privileges in schema public
  grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public
  grant usage, select on sequences to app_user;


-- -----------------------------------------------------------------------------
-- 2. ACTIVAR RLS EN TODAS LAS TABLAS
-- -----------------------------------------------------------------------------

-- Catálogo global (lectura abierta, escritura restringida)
alter table public.planes        enable row level security;
alter table public.modulos       enable row level security;
alter table public.plan_modulos  enable row level security;

-- Tenants
alter table public.empresas                 enable row level security;
alter table public.empresa_suscripciones    enable row level security;
alter table public.empresa_modulos_extra    enable row level security;

-- Usuarios y seguridad
alter table public.roles_empresa            enable row level security;
alter table public.usuarios_empresa         enable row level security;
alter table public.empresa_politicas_acceso enable row level security;
alter table public.dispositivos_autorizados enable row level security;
alter table public.empresa_ips_permitidas   enable row level security;
alter table public.sesiones_usuario         enable row level security;

-- Auditoría
alter table public.auditoria                enable row level security;

-- Inventario
alter table public.almacenes                enable row level security;
alter table public.categorias               enable row level security;
alter table public.unidades_medida          enable row level security;
alter table public.productos                enable row level security;
alter table public.stock_actual             enable row level security;
alter table public.movimientos_stock        enable row level security;


-- -----------------------------------------------------------------------------
-- 3. POLÍTICAS — TABLAS GLOBALES (solo lectura para tenants)
-- -----------------------------------------------------------------------------

create policy planes_read_all on public.planes
  for select to app_user using (true);

create policy modulos_read_all on public.modulos
  for select to app_user using (true);

create policy plan_modulos_read_all on public.plan_modulos
  for select to app_user using (true);

-- (Inserts/updates/deletes en estas 3 tablas se hacen con service-role.)


-- -----------------------------------------------------------------------------
-- 4. POLÍTICAS — EMPRESAS
-- Una empresa solo puede ver SU propia fila en empresas (la suya).
-- Suscripciones y módulos extra: filtrado por empresa_id del contexto.
-- -----------------------------------------------------------------------------

create policy empresas_self on public.empresas
  for all to app_user
  using      (id = public.current_empresa_id())
  with check (id = public.current_empresa_id());

create policy empresa_suscripciones_isolated on public.empresa_suscripciones
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy empresa_modulos_extra_isolated on public.empresa_modulos_extra
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());


-- -----------------------------------------------------------------------------
-- 5. POLÍTICAS — USUARIOS Y SEGURIDAD
-- -----------------------------------------------------------------------------

create policy roles_empresa_isolated on public.roles_empresa
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy usuarios_empresa_isolated on public.usuarios_empresa
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy politicas_isolated on public.empresa_politicas_acceso
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy dispositivos_isolated on public.dispositivos_autorizados
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy ips_isolated on public.empresa_ips_permitidas
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy sesiones_isolated on public.sesiones_usuario
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());


-- -----------------------------------------------------------------------------
-- 6. POLÍTICAS — AUDITORÍA
-- Lectura por empresa. Inserción libre (cualquier módulo escribe).
-- Update/delete bloqueado: la auditoría es inmutable.
-- -----------------------------------------------------------------------------

create policy auditoria_read on public.auditoria
  for select to app_user
  using (empresa_id = public.current_empresa_id());

create policy auditoria_insert on public.auditoria
  for insert to app_user
  with check (empresa_id = public.current_empresa_id());

-- (No se crea policy para UPDATE ni DELETE → bloqueado por defecto cuando RLS
--  está activo y no hay policy permisiva.)


-- -----------------------------------------------------------------------------
-- 7. POLÍTICAS — MÓDULO INVENTARIO
-- Patrón idéntico: filtrar por empresa_id en using y with check.
-- -----------------------------------------------------------------------------

create policy almacenes_isolated on public.almacenes
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy categorias_isolated on public.categorias
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy unidades_isolated on public.unidades_medida
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy productos_isolated on public.productos
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy stock_actual_isolated on public.stock_actual
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy movimientos_stock_isolated on public.movimientos_stock
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());


-- -----------------------------------------------------------------------------
-- 8. FUNCIÓN TRANSACCIONAL: registrar_movimiento_stock
-- Toda mutación de stock pasa por aquí. Garantiza:
--   - escribe el ledger (movimientos_stock)
--   - actualiza el snapshot (stock_actual) atómicamente
--   - recalcula costo promedio ponderado en entradas
-- Llámala desde el use case del backend, no hagas UPDATE directo a stock_actual.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_movimiento_stock(
  p_producto_id    uuid,
  p_almacen_id     uuid,
  p_tipo           text,                 -- 'entrada' | 'salida' | 'ajuste' | 'transferencia_in' | 'transferencia_out'
  p_cantidad       numeric,              -- siempre positiva
  p_costo_unitario numeric default 0,
  p_referencia_tipo text default null,
  p_referencia_id  uuid default null,
  p_motivo         text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_empresa_id    uuid := public.current_empresa_id();
  v_user_id       uuid := public.current_user_id();
  v_movimiento_id uuid;
  v_signo         int;
  v_stock_actual  numeric;
  v_costo_actual  numeric;
  v_nuevo_costo   numeric;
begin
  if v_empresa_id is null then
    raise exception 'tenant context not set';
  end if;
  if p_cantidad <= 0 then
    raise exception 'cantidad debe ser positiva';
  end if;

  v_signo := case
    when p_tipo in ('entrada','transferencia_in','ajuste') then 1
    when p_tipo in ('salida','transferencia_out') then -1
    else null
  end;
  if v_signo is null then
    raise exception 'tipo de movimiento inválido: %', p_tipo;
  end if;

  -- Insert ledger
  insert into public.movimientos_stock
    (empresa_id, producto_id, almacen_id, tipo, cantidad,
     costo_unitario, referencia_tipo, referencia_id, motivo, user_id)
  values
    (v_empresa_id, p_producto_id, p_almacen_id, p_tipo, p_cantidad,
     p_costo_unitario, p_referencia_tipo, p_referencia_id, p_motivo, v_user_id)
  returning id into v_movimiento_id;

  -- Upsert snapshot con cálculo de costo promedio ponderado en entradas
  insert into public.stock_actual (empresa_id, producto_id, almacen_id, cantidad, costo_promedio)
  values (v_empresa_id, p_producto_id, p_almacen_id, p_cantidad * v_signo, p_costo_unitario)
  on conflict (empresa_id, producto_id, almacen_id) do update
    set
      cantidad = stock_actual.cantidad + (excluded.cantidad),
      costo_promedio = case
        when v_signo = 1 and (stock_actual.cantidad + excluded.cantidad) > 0 then
          ((stock_actual.cantidad * stock_actual.costo_promedio) +
           (excluded.cantidad * excluded.costo_promedio))
          / nullif(stock_actual.cantidad + excluded.cantidad, 0)
        else stock_actual.costo_promedio
      end,
      updated_at = now();

  -- Validación post: no permitir stock negativo (salvo override)
  select cantidad into v_stock_actual
    from public.stock_actual
   where empresa_id = v_empresa_id
     and producto_id = p_producto_id
     and almacen_id  = p_almacen_id;

  if v_stock_actual < 0 then
    raise exception 'stock insuficiente: producto=% almacen=% queda=%',
      p_producto_id, p_almacen_id, v_stock_actual;
  end if;

  return v_movimiento_id;
end;
$$;

grant execute on function public.registrar_movimiento_stock(
  uuid, uuid, text, numeric, numeric, text, uuid, text
) to app_user;


-- -----------------------------------------------------------------------------
-- 9. UTILIDAD: ¿la empresa actual tiene acceso al módulo X?
-- Útil para validar desde SQL (vistas, otras funciones).
-- En el backend FastAPI esto se chequea antes con el JWT, pero tener la función
-- en DB permite usarla en checks de policy si quieres ser aún más estricto.
-- -----------------------------------------------------------------------------
create or replace function public.empresa_tiene_modulo(p_codigo_modulo text)
returns boolean
language sql
stable
as $$
  with mod as (select id from public.modulos where codigo = p_codigo_modulo limit 1),
       sub as (
         select plan_id from public.empresa_suscripciones
          where empresa_id = public.current_empresa_id()
            and estado in ('trial','activa','morosa')
          limit 1
       )
  select exists (
    select 1 from public.plan_modulos pm, sub, mod
     where pm.plan_id = sub.plan_id and pm.modulo_id = mod.id
  )
  or exists (
    select 1 from public.empresa_modulos_extra eme, mod
     where eme.empresa_id = public.current_empresa_id()
       and eme.modulo_id = mod.id
       and eme.activo = true
       and (eme.fin is null or eme.fin >= current_date)
  );
$$;

grant execute on function public.empresa_tiene_modulo(text) to app_user;

-- =============================================================================
-- FIN DE RLS
-- Siguiente paso: 03-seed.sql para cargar planes y módulos iniciales.
-- =============================================================================
