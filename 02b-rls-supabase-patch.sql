-- =============================================================================
-- 02b-rls-supabase-patch.sql
-- Parche para hacer que RLS funcione con el rol nativo de Supabase
-- (`authenticated`) y leyendo el `empresa_id` directamente del JWT.
--
-- Ejecutar DESPUÉS de 01-schema.sql, 02-rls.sql y 03-seed.sql.
-- Este parche reemplaza toda la capa RLS de 02-rls.sql para alinearse con
-- el modelo de Supabase. No tienes que dropear nada manualmente: este
-- archivo dropea y recrea las policies por ti.
--
-- Modelo Supabase:
--   - `anon`          → llamadas sin login
--   - `authenticated` → llamadas con JWT válido (lo que usaremos siempre)
--   - `service_role`  → bypass de RLS (solo backend para tareas internas)
--
-- Flujo en producción:
--   1. Usuario hace login → Supabase emite JWT.
--   2. El backend FastAPI agrega `empresa_id` y `rol` como claims customizados
--      al JWT (vía Custom Access Token Hook de Supabase Auth o regenerándolo
--      desde el backend).
--   3. Cada request que viaja con ese JWT entra a la DB con rol `authenticated`
--      y RLS lee `auth.jwt() ->> 'empresa_id'`.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. REEMPLAZAR LA FUNCIÓN current_empresa_id()
-- Ahora lee primero del JWT (Supabase nativo), con fallback al GUC para
-- testing manual desde SQL Editor.
-- -----------------------------------------------------------------------------
create or replace function public.current_empresa_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    -- Producción: claim 'empresa_id' inyectado en el JWT
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'empresa_id',
    -- Testing manual (SQL Editor): override por GUC
    nullif(current_setting('app.current_empresa_id', true), '')
  )::uuid;
$$;

-- También para current_user_id: usar auth.uid() en Supabase con fallback al GUC
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    auth.uid(),
    nullif(current_setting('app.current_user_id', true), '')::uuid
  );
$$;


-- -----------------------------------------------------------------------------
-- 2. DROPEAR POLICIES ANTERIORES (las que apuntaban a app_user)
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'planes','modulos','plan_modulos',
         'empresas','empresa_suscripciones','empresa_modulos_extra',
         'roles_empresa','usuarios_empresa',
         'empresa_politicas_acceso','dispositivos_autorizados',
         'empresa_ips_permitidas','sesiones_usuario',
         'auditoria',
         'almacenes','categorias','unidades_medida',
         'productos','stock_actual','movimientos_stock'
       )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end$$;


-- -----------------------------------------------------------------------------
-- 3. PERMISOS PARA LOS ROLES NATIVOS DE SUPABASE
-- `authenticated` es a quien le otorgamos acceso (con RLS filtrando).
-- `anon` no debe tocar nada operativo.
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;


-- -----------------------------------------------------------------------------
-- 4. POLICIES — TABLAS GLOBALES (catálogo público de planes/módulos)
-- Lectura para cualquier autenticado. Escritura solo via service_role.
-- -----------------------------------------------------------------------------
create policy planes_read       on public.planes       for select to authenticated using (true);
create policy modulos_read      on public.modulos      for select to authenticated using (true);
create policy plan_modulos_read on public.plan_modulos for select to authenticated using (true);


-- -----------------------------------------------------------------------------
-- 5. POLICIES — EMPRESAS, SUSCRIPCIONES, ADDONS
-- -----------------------------------------------------------------------------
create policy empresas_self on public.empresas
  for all to authenticated
  using      (id = public.current_empresa_id())
  with check (id = public.current_empresa_id());

create policy empresa_suscripciones_isolated on public.empresa_suscripciones
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy empresa_modulos_extra_isolated on public.empresa_modulos_extra
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());


-- -----------------------------------------------------------------------------
-- 6. POLICIES — USUARIOS Y SEGURIDAD
-- -----------------------------------------------------------------------------
create policy roles_empresa_isolated on public.roles_empresa
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy usuarios_empresa_isolated on public.usuarios_empresa
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy politicas_isolated on public.empresa_politicas_acceso
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy dispositivos_isolated on public.dispositivos_autorizados
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy ips_isolated on public.empresa_ips_permitidas
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy sesiones_isolated on public.sesiones_usuario
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());


-- -----------------------------------------------------------------------------
-- 7. POLICIES — AUDITORÍA (lectura + insert; update/delete bloqueado)
-- -----------------------------------------------------------------------------
create policy auditoria_read on public.auditoria
  for select to authenticated
  using (empresa_id = public.current_empresa_id());

create policy auditoria_insert on public.auditoria
  for insert to authenticated
  with check (empresa_id = public.current_empresa_id());


-- -----------------------------------------------------------------------------
-- 8. POLICIES — INVENTARIO
-- -----------------------------------------------------------------------------
create policy almacenes_isolated on public.almacenes
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy categorias_isolated on public.categorias
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy unidades_isolated on public.unidades_medida
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy productos_isolated on public.productos
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy stock_actual_isolated on public.stock_actual
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy movimientos_stock_isolated on public.movimientos_stock
  for all to authenticated
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());


-- -----------------------------------------------------------------------------
-- 9. EXECUTE EN LA FUNCIÓN TRANSACCIONAL DE STOCK PARA authenticated
-- -----------------------------------------------------------------------------
grant execute on function public.registrar_movimiento_stock(
  uuid, uuid, text, numeric, numeric, text, uuid, text
) to authenticated;

grant execute on function public.empresa_tiene_modulo(text) to authenticated;
grant execute on function public.current_empresa_id() to authenticated, anon;
grant execute on function public.current_user_id()    to authenticated, anon;

commit;

-- =============================================================================
-- FIN DEL PARCHE
-- Siguiente: ver README → "Cómo testear RLS desde el SQL Editor de Supabase"
-- =============================================================================
