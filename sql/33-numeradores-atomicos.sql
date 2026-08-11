-- =============================================================================
-- 33-numeradores-atomicos.sql
-- BUG: next_numero_venta/next_numero_cotizacion calculaban el correlativo con
-- `count(*) + 1` sin ningún bloqueo. Dos ventas creadas en el mismo instante
-- (dos cajeros simultáneos) podían calcular el MISMO número, y el segundo
-- insert fallaba con un 500 genérico por violar el UNIQUE(empresa_id, numero).
--
-- FIX: tabla contadora dedicada por (empresa, tipo, año), incrementada de
-- forma atómica con INSERT ... ON CONFLICT DO UPDATE — Postgres serializa
-- automáticamente los conflictos concurrentes a nivel de fila, así que dos
-- llamadas simultáneas nunca pueden obtener el mismo número (a diferencia de
-- un SELECT count(*) + INSERT en dos pasos, que sí tiene ventana de carrera).
--
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.numeradores (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo       text NOT NULL CHECK (tipo IN ('venta', 'cotizacion')),
  anio       int  NOT NULL,
  ultimo     int  NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, tipo, anio)
);

ALTER TABLE public.numeradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_numeradores" ON public.numeradores
  FOR ALL TO app_user
  USING      (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- Semilla: arranca cada contador en el máximo ya usado hoy, para no repetir
-- números si ya existen ventas/cotizaciones este año (migración segura sobre
-- datos reales — si no hay filas, no crea nada).
INSERT INTO public.numeradores (empresa_id, tipo, anio, ultimo)
SELECT empresa_id, 'venta', extract(year FROM fecha)::int,
       max(substring(numero FROM 'V-\d{4}-(\d+)')::int)
  FROM public.ventas
 WHERE numero ~ '^V-\d{4}-\d+$'
 GROUP BY empresa_id, extract(year FROM fecha)
ON CONFLICT (empresa_id, tipo, anio) DO UPDATE
  SET ultimo = GREATEST(public.numeradores.ultimo, EXCLUDED.ultimo);

INSERT INTO public.numeradores (empresa_id, tipo, anio, ultimo)
SELECT empresa_id, 'cotizacion', extract(year FROM fecha)::int,
       max(substring(numero FROM 'COT-\d{4}-(\d+)')::int)
  FROM public.cotizaciones
 WHERE numero ~ '^COT-\d{4}-\d+$'
 GROUP BY empresa_id, extract(year FROM fecha)
ON CONFLICT (empresa_id, tipo, anio) DO UPDATE
  SET ultimo = GREATEST(public.numeradores.ultimo, EXCLUDED.ultimo);
