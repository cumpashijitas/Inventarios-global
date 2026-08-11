-- =============================================================================
-- 36-resync-numeradores.sql
-- Recalcula public.numeradores desde los datos REALES de ventas/cotizaciones
-- (por si quedó desincronizado tras un reset o una siembra hecha antes de que
-- existieran ciertos registros). Idempotente y seguro — usa GREATEST, nunca
-- hace retroceder un contador, solo lo sube si hace falta.
--
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

-- ── 1. Diagnóstico — corre esto primero y mira el resultado ────────────────
WITH real_cot AS (
  SELECT empresa_id, extract(year FROM fecha)::int AS anio,
         max(substring(numero FROM 'COT-\d{4}-(\d+)')::int) AS max_real
    FROM public.cotizaciones
   WHERE numero ~ '^COT-\d{4}-\d+$'
   GROUP BY empresa_id, extract(year FROM fecha)
),
real_venta AS (
  SELECT empresa_id, extract(year FROM fecha)::int AS anio,
         max(substring(numero FROM 'V-\d{4}-(\d+)')::int) AS max_real
    FROM public.ventas
   WHERE numero ~ '^V-\d{4}-\d+$'
   GROUP BY empresa_id, extract(year FROM fecha)
)
SELECT 'cotizacion' AS tipo, r.empresa_id, r.anio, r.max_real, n.ultimo AS ultimo_en_tabla
  FROM real_cot r
  LEFT JOIN public.numeradores n
    ON n.empresa_id = r.empresa_id AND n.tipo = 'cotizacion' AND n.anio = r.anio
UNION ALL
SELECT 'venta', r.empresa_id, r.anio, r.max_real, n.ultimo
  FROM real_venta r
  LEFT JOIN public.numeradores n
    ON n.empresa_id = r.empresa_id AND n.tipo = 'venta' AND n.anio = r.anio;

-- ── 2. Corrección — sube el contador al máximo real si estaba atrasado ─────
INSERT INTO public.numeradores (empresa_id, tipo, anio, ultimo)
SELECT empresa_id, 'cotizacion', extract(year FROM fecha)::int,
       max(substring(numero FROM 'COT-\d{4}-(\d+)')::int)
  FROM public.cotizaciones
 WHERE numero ~ '^COT-\d{4}-\d+$'
 GROUP BY empresa_id, extract(year FROM fecha)
ON CONFLICT (empresa_id, tipo, anio) DO UPDATE
  SET ultimo = GREATEST(public.numeradores.ultimo, EXCLUDED.ultimo);

INSERT INTO public.numeradores (empresa_id, tipo, anio, ultimo)
SELECT empresa_id, 'venta', extract(year FROM fecha)::int,
       max(substring(numero FROM 'V-\d{4}-(\d+)')::int)
  FROM public.ventas
 WHERE numero ~ '^V-\d{4}-\d+$'
 GROUP BY empresa_id, extract(year FROM fecha)
ON CONFLICT (empresa_id, tipo, anio) DO UPDATE
  SET ultimo = GREATEST(public.numeradores.ultimo, EXCLUDED.ultimo);
