-- =============================================================================
-- 05-rls-extension.sql — RLS para las tablas nuevas del 04-schema-extension
-- Mismo patrón que 02-rls.sql: empresa_id = public.current_empresa_id()
-- =============================================================================

-- Activar RLS
alter table public.proveedores     enable row level security;
alter table public.clientes        enable row level security;
alter table public.ventas          enable row level security;
alter table public.ventas_items    enable row level security;
alter table public.cotizaciones    enable row level security;
alter table public.cotizaciones_items enable row level security;
alter table public.caja_sesiones   enable row level security;
alter table public.caja_movimientos enable row level security;
alter table public.lotes_compra    enable row level security;
alter table public.lotes_items     enable row level security;

-- Políticas (patrón uniforme)
create policy proveedores_isolated on public.proveedores
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy clientes_isolated on public.clientes
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy ventas_isolated on public.ventas
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy ventas_items_isolated on public.ventas_items
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy cotizaciones_isolated on public.cotizaciones
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy cotizaciones_items_isolated on public.cotizaciones_items
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy caja_sesiones_isolated on public.caja_sesiones
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy caja_movimientos_isolated on public.caja_movimientos
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy lotes_compra_isolated on public.lotes_compra
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy lotes_items_isolated on public.lotes_items
  for all to app_user
  using      (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- Módulos nuevos en el sistema
insert into public.modulos (codigo, nombre, descripcion, categoria) values
  ('ventas',    'Ventas y Cotizaciones',  'Ventas al cliente, cotizaciones, recibos',   'core'),
  ('caja',      'Gestión de Caja',        'Apertura/cierre de caja, movimientos',       'core'),
  ('compras',   'Compras y Lotes',        'Lotes de compra, carga masiva, proveedores', 'core'),
  ('reportes',  'Reportes',               'Reportes de ventas, inventario, movimientos','core'),
  ('dashboard', 'Dashboard',              'Estadísticas en tiempo real',                'core')
on conflict (codigo) do nothing;