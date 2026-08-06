-- =============================================================================
-- 28-fix-fk-roles.sql
-- Arregla el FK de usuarios_empresa.rol_id → roles_empresa
-- El problema: hay usuarios cuya empresa_id no tiene roles en roles_empresa
-- (porque el seed del 27 filtraba por deleted_at IS NULL en empresas).
-- =============================================================================

-- 1. Crear roles para TODAS las empresas que tienen usuarios,
--    sin importar si la empresa está eliminada o no.
INSERT INTO public.roles_empresa (empresa_id, codigo, nombre, descripcion, permisos, es_sistema)
SELECT DISTINCT
  ue.empresa_id,
  r.codigo,
  r.nombre,
  r.descripcion,
  r.permisos::jsonb,
  true
FROM public.usuarios_empresa ue,
(VALUES
  ('admin',                'Administrador',   'Control total del sistema',           '[]'::text),
  ('vendedor',             'Vendedor',        'Acceso a ventas e inventario',        '["ventas.ver","ventas.crear","inventario.ver","reportes.ver"]'),
  ('encargado_inventario', 'Enc. Inventario', 'Gestión completa de inventario',     '["inventario.ver","inventario.editar","reportes.ver"]'),
  ('cajero',               'Cajero',          'Gestión de caja, ventas y pagos',    '["caja.ver","ventas.ver","reportes.ver"]')
) AS r(codigo, nombre, descripcion, permisos)
ON CONFLICT (empresa_id, codigo) DO NOTHING;

-- 2. Ahora actualizar TODOS los usuarios al rol admin de su empresa
UPDATE public.usuarios_empresa ue
SET rol_id = re.id
FROM public.roles_empresa re
WHERE re.empresa_id = ue.empresa_id
  AND re.codigo = 'admin';

-- 3. Verificar que no quede ningún rol_id huérfano antes de agregar el FK
-- (Si este SELECT devuelve filas, hay un bug más profundo)
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.usuarios_empresa ue
  WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_empresa re WHERE re.id = ue.rol_id
  );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Todavía hay % usuarios con rol_id huérfano. Revisar manualmente.', v_count;
  END IF;
END;
$$;

-- 4. Restaurar FK
ALTER TABLE public.usuarios_empresa
  DROP CONSTRAINT IF EXISTS usuarios_empresa_rol_id_fkey;
ALTER TABLE public.usuarios_empresa
  ADD CONSTRAINT usuarios_empresa_rol_id_fkey
  FOREIGN KEY (rol_id) REFERENCES public.roles_empresa(id);

SELECT 'FK restaurado OK' AS resultado;
