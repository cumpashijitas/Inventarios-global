-- =============================================================================
-- 07-limpiar-datos-operativos.sql
-- Borra SOLO los datos operativos (productos, proveedores, clientes, ventas…)
-- CONSERVA: empresa, usuario, suscripción, almacenes, unidades de medida,
--            planes, módulos, roles — todo lo necesario para seguir logueado.
-- =============================================================================
-- Ejecutar en: Supabase SQL Editor (rol postgres)
-- =============================================================================

-- Deshabilitar FK checks temporalmente para poder truncar en cualquier orden
set session_replication_role = replica;

-- ── Auditoría ─────────────────────────────────────────────────────────────────
truncate table public.auditoria restart identity cascade;

-- ── Lotes de compra ───────────────────────────────────────────────────────────
truncate table public.lotes_items    restart identity cascade;
truncate table public.lotes_compra   restart identity cascade;

-- ── Caja ──────────────────────────────────────────────────────────────────────
truncate table public.caja_movimientos restart identity cascade;
truncate table public.caja_sesiones    restart identity cascade;

-- ── Ventas y cotizaciones ─────────────────────────────────────────────────────
truncate table public.cotizaciones_items restart identity cascade;
truncate table public.cotizaciones       restart identity cascade;
truncate table public.ventas_items       restart identity cascade;
truncate table public.ventas             restart identity cascade;

-- ── Stock e inventario ────────────────────────────────────────────────────────
truncate table public.movimientos_stock restart identity cascade;
truncate table public.stock_actual      restart identity cascade;
truncate table public.productos         restart identity cascade;

-- ── Contactos ────────────────────────────────────────────────────────────────
truncate table public.proveedores restart identity cascade;
truncate table public.clientes    restart identity cascade;

-- ── Categorías (opcional — descomenta si también quieres borrarlas) ───────────
-- truncate table public.categorias restart identity cascade;

-- Restaurar FK checks
set session_replication_role = default;

-- ── Verificación ─────────────────────────────────────────────────────────────
select 'Datos operativos eliminados. Conteos:' as resultado;

select 'productos'       as tabla, count(*) as filas from public.productos
union all
select 'proveedores',   count(*) from public.proveedores
union all
select 'clientes',      count(*) from public.clientes
union all
select 'ventas',        count(*) from public.ventas
union all
select 'caja_sesiones', count(*) from public.caja_sesiones
union all
select 'lotes_compra',  count(*) from public.lotes_compra
union all
select 'stock_actual',  count(*) from public.stock_actual
union all
select 'movimientos_stock', count(*) from public.movimientos_stock
-- Estas deben seguir teniendo datos (no se borraron):
union all
select '--- CONSERVADOS ---', 0
union all
select 'empresas',         count(*) from public.empresas
union all
select 'usuarios_empresa', count(*) from public.usuarios_empresa
union all
select 'almacenes',        count(*) from public.almacenes
union all
select 'unidades_medida',  count(*) from public.unidades_medida
union all
select 'planes',           count(*) from public.planes
union all
select 'modulos',          count(*) from public.modulos;
