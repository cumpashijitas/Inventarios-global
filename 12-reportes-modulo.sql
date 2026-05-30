-- =============================================================================
-- 12-reportes-modulo.sql
-- Agrega el módulo 'reportes' a la tabla modulos y lo asigna a todos los planes.
-- Ejecutar una sola vez (idempotente).
-- =============================================================================

-- Insertar módulo reportes
insert into public.modulos (codigo, nombre, descripcion, categoria, precio_addon) values
  ('reportes', 'Reportes', 'Reportes de ventas, inventario y movimientos de stock con exportación PDF/CSV.', 'core', 0)
on conflict (codigo) do update set
  nombre       = excluded.nombre,
  descripcion  = excluded.descripcion,
  categoria    = excluded.categoria,
  precio_addon = excluded.precio_addon;

-- Asignar a todos los planes (reportes es básico para cualquier plan)
insert into public.plan_modulos (plan_id, modulo_id)
select p.id, m.id
  from public.planes p
  cross join public.modulos m
 where m.codigo = 'reportes'
on conflict do nothing;

commit;

-- Verificación:
-- select p.codigo, m.nombre
--   from public.planes p
--   join public.plan_modulos pm on pm.plan_id = p.id
--   join public.modulos m on m.id = pm.modulo_id
--  where m.codigo = 'reportes';
