-- =============================================================
-- 26-single-tenant.sql
-- Elimina arquitectura multi-tenant: RLS, tablas SaaS, funciones
-- Sistema de un solo cliente — sin overhead de tenant context
-- Ejecutar en Supabase SQL Editor
-- =============================================================

-- 1. Deshabilitar RLS en TODAS las tablas del schema public
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- 2. Eliminar TODAS las policies RLS del schema public
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 3. Quitar FK de usuarios_empresa.rol_id para poder eliminar roles_empresa
ALTER TABLE public.usuarios_empresa
    DROP CONSTRAINT IF EXISTS usuarios_empresa_rol_id_fkey;

-- 4. Eliminar tablas SaaS (en orden de dependencias)
DROP TABLE IF EXISTS public.empresa_ips_permitidas   CASCADE;
DROP TABLE IF EXISTS public.dispositivos_autorizados CASCADE;
DROP TABLE IF EXISTS public.sesiones_usuario         CASCADE;
DROP TABLE IF EXISTS public.empresa_politicas_acceso CASCADE;
DROP TABLE IF EXISTS public.empresa_modulos_extra    CASCADE;
DROP TABLE IF EXISTS public.plan_modulos             CASCADE;
DROP TABLE IF EXISTS public.empresa_suscripciones   CASCADE;
DROP TABLE IF EXISTS public.modulos                 CASCADE;
DROP TABLE IF EXISTS public.planes                  CASCADE;
DROP TABLE IF EXISTS public.roles_empresa           CASCADE;

-- 5. Reemplazar current_empresa_id() — ya no necesita set_config,
--    simplemente devuelve el id del único registro en empresas.
--    Las funciones registrar_movimiento_stock y confirmar_lote siguen funcionando.
CREATE OR REPLACE FUNCTION public.current_empresa_id() RETURNS uuid AS $$
    SELECT id FROM public.empresas LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. Eliminar funciones que ya no se usan
DROP FUNCTION IF EXISTS public.empresa_tiene_modulo(text);

-- current_user_id() la usan internamente registrar_movimiento_stock y confirmar_lote
-- Se reemplaza por versión que devuelve NULL sin error si no está seteado
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS uuid AS $$
    SELECT nullif(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;
