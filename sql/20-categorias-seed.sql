-- =============================================================================
-- 20-categorias-seed.sql
-- Crea las 18 categorías consolidadas para la tienda de repuestos.
-- Idempotente: usa ON CONFLICT DO NOTHING.
-- Ejecutar DESPUÉS de tener la empresa creada (necesita empresa_id).
-- =============================================================================
-- Reemplaza <EMPRESA_ID> con el UUID real de tu empresa antes de ejecutar.
-- Para obtenerlo: SELECT id FROM public.empresas LIMIT 1;
-- =============================================================================

DO $$
DECLARE
  v_empresa_id uuid;
BEGIN
  -- Obtener el único empresa_id disponible
  SELECT id INTO v_empresa_id FROM public.empresas LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'No hay empresa creada. Ejecuta primero el script de creación de empresa.';
  END IF;

  INSERT INTO public.categorias (empresa_id, nombre, orden, activo) VALUES
    (v_empresa_id, 'RODAMIENTOS',              1,  true),
    (v_empresa_id, 'CORREAS Y CADENAS',         2,  true),
    (v_empresa_id, 'RETENES Y SELLOS',          3,  true),
    (v_empresa_id, 'EMPAQUETADURAS Y JUNTAS',   4,  true),
    (v_empresa_id, 'AMORTIGUADORES Y SUSPENSION',5, true),
    (v_empresa_id, 'MOTOR',                     6,  true),
    (v_empresa_id, 'FRENOS',                    7,  true),
    (v_empresa_id, 'EMBRAGUE',                  8,  true),
    (v_empresa_id, 'DIRECCION',                 9,  true),
    (v_empresa_id, 'TRANSMISION',               10, true),
    (v_empresa_id, 'ELECTRICIDAD',              11, true),
    (v_empresa_id, 'FILTROS',                   12, true),
    (v_empresa_id, 'COMBUSTIBLE E INYECCION',   13, true),
    (v_empresa_id, 'LUBRICANTES Y FLUIDOS',     14, true),
    (v_empresa_id, 'ENFRIAMIENTO',              15, true),
    (v_empresa_id, 'CHICOTILLOS Y CABLES',      16, true),
    (v_empresa_id, 'CARROCERIA',                17, true),
    (v_empresa_id, 'FIJACIONES Y VARIOS',       18, true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Categorias creadas para empresa %', v_empresa_id;
END $$;

-- Verificar
SELECT nombre, orden FROM public.categorias ORDER BY orden;
