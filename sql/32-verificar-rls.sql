-- =============================================================================
-- 32-verificar-rls.sql
-- Script de DIAGNÓSTICO — NO modifica nada, solo lee. Ejecutar en Supabase
-- SQL Editor para confirmar que el aislamiento multi-tenant (RLS) está
-- correctamente activo en la base real, después de todo lo que se tocó en
-- sql/26 a sql/31 (single-tenant, restauraciones, fix de ip_permitidas).
--
-- Corre las 3 consultas por separado y revisa el resultado de cada una.
-- Si las 3 devuelven "sin filas" (0 resultados), todo está bien.
-- =============================================================================

-- ── 1. Tablas con columna empresa_id que NO tienen RLS activado ────────────
-- Cualquier fila aquí es CRÍTICO: esa tabla no tiene ningún aislamiento
-- entre empresas, cualquier usuario autenticado puede ver/editar todo.
SELECT c.relname AS tabla
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relrowsecurity = false
   AND EXISTS (
     SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = 'public'
        AND col.table_name = c.relname
        AND col.column_name = 'empresa_id'
   )
 ORDER BY tabla;

-- ── 2. Tablas con RLS activado pero SIN ninguna policy ──────────────────────
-- No es una fuga (Postgres bloquea todo por defecto sin policies), pero
-- significa que esa tabla es 100% inaccesible para el backend — probablemente
-- una tabla que quedó a medio configurar tras algún script de restauración.
SELECT c.relname AS tabla
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relrowsecurity = true
   AND NOT EXISTS (
     SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
   )
 ORDER BY tabla;

-- ── 3. Policies que NO usan la función canónica current_empresa_id() ───────
-- Este es el chequeo que hubiera detectado el bug de ip_permitidas antes de
-- que pasara: cualquier policy en una tabla con empresa_id que no mencione
-- current_empresa_id() en su condición está probablemente usando el GUC
-- equivocado (como current_setting('app.empresa_id',...) en vez de
-- 'app.current_empresa_id') o algún otro criterio no estándar. Revisar cada
-- fila a mano.
SELECT p.tablename AS tabla, p.policyname AS policy, p.qual AS condicion_using, p.with_check AS condicion_with_check
  FROM pg_policies p
 WHERE p.schemaname = 'public'
   AND EXISTS (
     SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = 'public'
        AND col.table_name = p.tablename
        AND col.column_name = 'empresa_id'
   )
   AND coalesce(p.qual, '')       NOT ILIKE '%current_empresa_id%'
   AND coalesce(p.with_check, '') NOT ILIKE '%current_empresa_id%'
 ORDER BY tabla, policy;
