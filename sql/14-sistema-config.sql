-- =============================================================================
-- 14-sistema-config.sql
-- Agrega columna configuracion_app a empresas para guardar preferencias
-- del sistema (toggles de la tab "Sistema" en Configuración).
-- Idempotente: usa IF NOT EXISTS / ON CONFLICT.
-- =============================================================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS configuracion_app jsonb NOT NULL
  DEFAULT '{
    "notificaciones_email": true,
    "alertas_stock_bajo":   true,
    "backup_automatico":    true
  }'::jsonb;

COMMENT ON COLUMN public.empresas.configuracion_app IS
  'Preferencias del sistema por empresa: notificaciones, alertas, backup, etc.';
