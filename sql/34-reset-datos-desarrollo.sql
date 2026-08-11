-- =============================================================================
-- 34-reset-datos-desarrollo.sql
-- Reset de datos operativos para la base de PRUEBA/DESARROLLO — confirmado
-- que NO es la base de producción real del cliente.
--
-- Hace, en este orden (respetando foreign keys):
--   1. Borra historial operativo: devoluciones, movimientos de caja/sesiones,
--      ítems de venta/cotización, ventas, cotizaciones, movimientos de stock.
--   2. Pone el stock de todos los productos en 0 (no borra el catálogo).
--   3. Reinicia los contadores de numeración (numeradores) — así la próxima
--      venta/cotización vuelve a arrancar en 0001.
--   4. Elimina (DELETE real, no soft-delete) todos los usuarios_empresa cuyo
--      rol NO sea 'admin' — deja solo las cuentas administradoras.
--
-- NO TOCA: productos, categorías, unidades, almacenes, clientes, proveedores,
-- empresas, ni la cuenta de Supabase Auth de los empleados eliminados (solo
-- se les quita el acceso a la empresa vía usuarios_empresa — si además
-- quieres borrar su login por completo, hazlo desde Authentication en el
-- dashboard de Supabase).
--
-- Aplica a TODAS las empresas de la base. Si quieres limitarlo a una sola,
-- agrega "and empresa_id = '<uuid>'" a cada DELETE/UPDATE marcado con ⬅.
--
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

BEGIN;

-- ── 1. Historial operativo ──────────────────────────────────────────────────
DELETE FROM public.devoluciones;                -- ⬅
DELETE FROM public.caja_movimientos;             -- ⬅
DELETE FROM public.caja_sesiones;                -- ⬅
DELETE FROM public.ventas_items;                 -- ⬅ (ya cascadea con ventas, explícito por claridad)
DELETE FROM public.cotizaciones_items;           -- ⬅ (ya cascadea con cotizaciones)
DELETE FROM public.ventas;                       -- ⬅
DELETE FROM public.cotizaciones;                 -- ⬅
DELETE FROM public.movimientos_stock;            -- ⬅

-- ── 2. Stock a 0 (mantiene el catálogo de productos/almacenes) ─────────────
UPDATE public.stock_actual                       -- ⬅
   SET cantidad = 0, costo_promedio = 0, updated_at = now();

-- ── 3. Reiniciar numeración de ventas/cotizaciones ──────────────────────────
DELETE FROM public.numeradores;                  -- ⬅

-- ── 4. Limpiar empleados — deja solo a los admin ────────────────────────────
DELETE FROM public.usuarios_empresa              -- ⬅
 WHERE rol_id NOT IN (
   SELECT id FROM public.roles_empresa WHERE codigo = 'admin'
 );

COMMIT;
