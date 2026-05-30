-- =============================================================================
-- 11-caja-modulo.sql
-- Agrega el módulo 'caja' a la tabla modulos y lo asigna a los planes que
-- incluyen ventas (profesional, distribuidora, empresarial).
-- Ejecutar una sola vez (idempotente).
-- =============================================================================

-- Insertar módulo caja
insert into public.modulos (codigo, nombre, descripcion, categoria, precio_addon) values
  ('caja', 'Caja', 'Control de caja diaria, movimientos, ingresos, retiros y arqueo.', 'core', 0)
on conflict (codigo) do update set
  nombre       = excluded.nombre,
  descripcion  = excluded.descripcion,
  categoria    = excluded.categoria,
  precio_addon = excluded.precio_addon;

-- Asignar a planes que incluyen el módulo de ventas
insert into public.plan_modulos (plan_id, modulo_id)
select p.id, m.id
  from public.planes p
  cross join public.modulos m
 where m.codigo = 'caja'
   and p.codigo in ('profesional', 'distribuidora', 'empresarial')
on conflict do nothing;

commit;

-- Verificación:
-- select p.codigo, m.nombre
--   from public.planes p
--   join public.plan_modulos pm on pm.plan_id = p.id
--   join public.modulos m on m.id = pm.modulo_id
--  where m.codigo = 'caja';
