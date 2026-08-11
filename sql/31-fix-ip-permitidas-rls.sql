-- =============================================================================
-- 31-fix-ip-permitidas-rls.sql
-- BUG: la policy de public.ip_permitidas leía el GUC "app.empresa_id", pero
-- todo el resto del sistema setea "app.current_empresa_id" (vía
-- acquire_tenant_conn → SET LOCAL app.current_empresa_id). current_setting()
-- con ese nombre nunca existía, así que la comparación jamás era verdadera y
-- la whitelist de IP quedaba inoperante desde que se creó (sql/15).
--
-- Nota: admin_repo.py ya filtra `WHERE empresa_id = $1` explícitamente en
-- cada query a esta tabla, así que este bug no permitía fugas entre tenants
-- por esa vía — pero la policy RLS (la segunda capa de defensa) no hacía
-- nada, y de paso el INSERT (agregar_ip) no tenía ninguna verificación de
-- empresa porque la policy original no tenía WITH CHECK.
--
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

DROP POLICY IF EXISTS "tenant_ip_permitidas" ON public.ip_permitidas;

CREATE POLICY "tenant_ip_permitidas" ON public.ip_permitidas
  FOR ALL TO app_user
  USING      (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());
