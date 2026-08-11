-- =============================================================================
-- 35-usuario-multiples-roles.sql
-- Permite asignar más de un rol a un usuario (ej. Encargado de Inventario +
-- Vendedor). Antes, usuarios_empresa.rol_id era una sola columna (un rol por
-- usuario) — ahora la relación usuario↔rol es muchos-a-muchos, vía una tabla
-- intermedia.
--
-- Reglas de negocio (las impone el código de aplicación, no la base):
--   - 'admin' es exclusivo — no se combina con otros roles.
--   - Los demás roles (vendedor, encargado_inventario, cajero) se pueden
--     combinar libremente: mínimo 1, máximo 3.
--
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.usuario_empresa_roles (
  empresa_id         uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_empresa_id uuid NOT NULL REFERENCES public.usuarios_empresa(id) ON DELETE CASCADE,
  rol_id             uuid NOT NULL REFERENCES public.roles_empresa(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_empresa_id, rol_id)
);
CREATE INDEX IF NOT EXISTS idx_uer_usuario ON public.usuario_empresa_roles(usuario_empresa_id);
CREATE INDEX IF NOT EXISTS idx_uer_empresa ON public.usuario_empresa_roles(empresa_id);

ALTER TABLE public.usuario_empresa_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_usuario_empresa_roles" ON public.usuario_empresa_roles
  FOR ALL TO app_user
  USING      (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- Migra el rol único que cada usuario ya tenía hacia la tabla nueva, para que
-- nadie quede sin rol tras el cambio.
INSERT INTO public.usuario_empresa_roles (empresa_id, usuario_empresa_id, rol_id)
SELECT empresa_id, id, rol_id
  FROM public.usuarios_empresa
 WHERE rol_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- usuarios_empresa.rol_id queda DEPRECADO — el código ya no lo escribe ni lo
-- lee (la fuente de verdad ahora es usuario_empresa_roles). Se deja la
-- columna en la tabla (nullable, no se borra) por seguridad — se puede
-- eliminar en una migración futura una vez confirmado que nada la usa.
ALTER TABLE public.usuarios_empresa ALTER COLUMN rol_id DROP NOT NULL;
