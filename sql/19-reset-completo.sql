-- =============================================================================
-- 19-reset-completo.sql
-- Limpia TODOS los datos operativos de la empresa.
-- CONSERVA: empresas, suscripción, planes, módulos, roles,
--           y el usuario admin velardep44@gmail.com
-- BORRA:    inventario, ventas, caja, lotes, clientes, proveedores,
--           categorías, almacenes, unidades de medida, auditoría,
--           sesiones, y todos los demás usuarios.
--
-- Ejecutar en: Supabase SQL Editor (con rol postgres)
-- =============================================================================

-- Deshabilitar FK checks para truncar en cualquier orden
set session_replication_role = replica;

-- ── Devoluciones (tabla nueva, puede no existir todavía) ─────────────────────
do $$ begin
  truncate public.devoluciones restart identity cascade;
exception when undefined_table then null;
end $$;

-- ── Auditoría ─────────────────────────────────────────────────────────────────
truncate table public.auditoria restart identity cascade;

-- ── Sesiones y dispositivos ───────────────────────────────────────────────────
truncate table public.sesiones_usuario        restart identity cascade;
truncate table public.dispositivos_autorizados restart identity cascade;

-- ── Lotes de compra ───────────────────────────────────────────────────────────
truncate table public.lotes_items  restart identity cascade;
truncate table public.lotes_compra restart identity cascade;

-- ── Caja ──────────────────────────────────────────────────────────────────────
truncate table public.caja_movimientos restart identity cascade;
truncate table public.caja_sesiones    restart identity cascade;

-- ── Ventas y cotizaciones ─────────────────────────────────────────────────────
truncate table public.cotizaciones_items restart identity cascade;
truncate table public.cotizaciones       restart identity cascade;
truncate table public.ventas_items       restart identity cascade;
truncate table public.ventas             restart identity cascade;

-- ── Inventario ────────────────────────────────────────────────────────────────
truncate table public.movimientos_stock restart identity cascade;
truncate table public.stock_actual      restart identity cascade;
truncate table public.productos         restart identity cascade;

-- ── Contactos ────────────────────────────────────────────────────────────────
truncate table public.proveedores restart identity cascade;
truncate table public.clientes    restart identity cascade;

-- ── Catálogos operativos ──────────────────────────────────────────────────────
truncate table public.categorias      restart identity cascade;
truncate table public.almacenes       restart identity cascade;
truncate table public.unidades_medida restart identity cascade;

-- ── Seguridad / acceso ────────────────────────────────────────────────────────
truncate table public.empresa_ips_permitidas restart identity cascade;

-- ── Otros usuarios — conservar SOLO velardep44@gmail.com ─────────────────────
delete from public.usuarios_empresa
where lower(email::text) <> 'velardep44@gmail.com';

-- Restaurar FK checks
set session_replication_role = default;

-- =============================================================================
-- VERIFICACIÓN — debe mostrar 0 en todo excepto la sección CONSERVADOS
-- =============================================================================
select tabla, filas from (
  select 'productos'         as tabla, count(*) as filas from public.productos
  union all
  select 'proveedores',      count(*) from public.proveedores
  union all
  select 'clientes',         count(*) from public.clientes
  union all
  select 'ventas',           count(*) from public.ventas
  union all
  select 'ventas_items',     count(*) from public.ventas_items
  union all
  select 'caja_sesiones',    count(*) from public.caja_sesiones
  union all
  select 'lotes_compra',     count(*) from public.lotes_compra
  union all
  select 'categorias',       count(*) from public.categorias
  union all
  select 'almacenes',        count(*) from public.almacenes
  union all
  select 'unidades_medida',  count(*) from public.unidades_medida
  union all
  select 'auditoria',        count(*) from public.auditoria
  union all
  select '─── CONSERVADOS ───' as tabla, 0 as filas
  union all
  select 'empresas',         count(*) from public.empresas
  union all
  select 'usuarios_empresa', count(*) from public.usuarios_empresa
  union all
  select 'roles_empresa',    count(*) from public.roles_empresa
  union all
  select 'planes',           count(*) from public.planes
  union all
  select 'modulos',          count(*) from public.modulos
) t;
