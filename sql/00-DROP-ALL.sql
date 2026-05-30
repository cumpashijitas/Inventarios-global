-- =============================================================================
-- 00-DROP-ALL.sql — Limpieza total del schema público
-- ⚠️  DESTRUCTIVO: elimina TODAS las tablas, funciones, vistas y triggers.
-- Ejecutar SOLO en desarrollo / staging. NUNCA en producción con datos reales.
-- =============================================================================
--
-- En Supabase: SQL Editor → pegar este script → Run
-- Luego ejecutar los scripts en orden: 01 → 02 → 02b → 03 → 04 → 05 → 06 → 99
-- =============================================================================

-- Deshabilitar restricciones FK para poder dropear en cualquier orden
set session_replication_role = replica;

-- ── Vistas ────────────────────────────────────────────────────────────────────
drop view if exists public.v_stock_consolidado cascade;

-- ── Tablas operativas nuevas (04-schema-extension) ───────────────────────────
drop table if exists public.lotes_items              cascade;
drop table if exists public.lotes_compra             cascade;
drop table if exists public.caja_movimientos         cascade;
drop table if exists public.caja_sesiones            cascade;
drop table if exists public.cotizaciones_items       cascade;
drop table if exists public.cotizaciones             cascade;
drop table if exists public.ventas_items             cascade;
drop table if exists public.ventas                   cascade;
drop table if exists public.clientes                 cascade;

-- ── Tablas inventario (01-schema) ────────────────────────────────────────────
drop table if exists public.movimientos_stock        cascade;
drop table if exists public.stock_actual             cascade;
drop table if exists public.productos                cascade;
drop table if exists public.proveedores              cascade;
drop table if exists public.unidades_medida          cascade;
drop table if exists public.categorias               cascade;
drop table if exists public.almacenes                cascade;

-- ── Auditoría ─────────────────────────────────────────────────────────────────
drop table if exists public.auditoria                cascade;

-- ── Usuarios y seguridad (01-schema) ─────────────────────────────────────────
drop table if exists public.sesiones_usuario         cascade;
drop table if exists public.empresa_ips_permitidas   cascade;
drop table if exists public.dispositivos_autorizados cascade;
drop table if exists public.empresa_politicas_acceso cascade;
drop table if exists public.usuarios_empresa         cascade;
drop table if exists public.roles_empresa            cascade;

-- ── Tenants y suscripciones (01-schema) ──────────────────────────────────────
drop table if exists public.empresa_modulos_extra    cascade;
drop table if exists public.empresa_suscripciones    cascade;
drop table if exists public.empresas                 cascade;

-- ── Catálogo global (01-schema) ───────────────────────────────────────────────
drop table if exists public.plan_modulos             cascade;
drop table if exists public.modulos                  cascade;
drop table if exists public.planes                   cascade;

-- ── Funciones ─────────────────────────────────────────────────────────────────
drop function if exists public.registrar_movimiento_stock(uuid,uuid,text,numeric,numeric,text,uuid,text) cascade;
drop function if exists public.confirmar_lote(uuid)       cascade;
drop function if exists public.empresa_tiene_modulo(text)  cascade;
drop function if exists public.current_empresa_id()        cascade;
drop function if exists public.current_user_id()           cascade;
drop function if exists public.set_updated_at()            cascade;

-- Restaurar modo normal
set session_replication_role = default;

-- Verificación
select 'DROP completado. Tablas restantes en schema public:' as mensaje;
select tablename from pg_tables where schemaname = 'public' order by tablename;
