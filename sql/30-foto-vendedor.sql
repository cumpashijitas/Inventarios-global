-- =============================================================================
-- 30-foto-vendedor.sql
-- Agrega foto de perfil a usuarios_empresa, para el ranking de vendedores
-- (velocímetros de ventas en Reportes/Dashboard). Cada usuario sube la suya.
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.usuarios_empresa
  ADD COLUMN IF NOT EXISTS foto_url text;
