-- =============================================================================
-- 03-seed.sql — Datos iniciales del catálogo
-- Carga los 4 planes vendibles y los módulos del sistema, y mapea qué
-- módulos incluye cada plan por defecto.
-- =============================================================================
--
-- Ejecutar como service-role / superuser (las políticas RLS de planes/modulos
-- son de solo lectura para app_user).
--
-- Idempotente: usa ON CONFLICT en codigo. Puedes correrlo varias veces.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- MÓDULOS
-- -----------------------------------------------------------------------------
insert into public.modulos (codigo, nombre, descripcion, categoria, precio_addon) values
  -- Core
  ('inventario',     'Inventario',           'Productos, almacenes, stock y movimientos.', 'core', 0),
  ('reportes_basicos','Reportes básicos',    'Reportes operativos de inventario.',         'core', 0),
  ('ventas',         'Ventas',               'Cotizaciones, ventas, clientes, cobros.',    'core', 0),
  ('compras',        'Compras',              'Órdenes de compra y proveedores.',           'core', 0),
  ('clientes',       'CRM Clientes',         'Ficha cliente, historial, segmentación.',    'core', 0),
  ('dashboard',      'Dashboard ejecutivo',  'KPIs en tiempo real.',                        'core', 0),
  ('multisucursal',  'Multi-sucursal',       'Gestión de varias sucursales con permisos.', 'core', 0),
  ('vendedores',     'Vendedores en campo',  'App móvil para fuerza de ventas.',           'core', 0),
  ('control_comercial','Control comercial',  'Comisiones, rutas, metas.',                  'core', 0),
  ('credito',        'Crédito y cobranzas',  'Líneas de crédito, mora, recordatorios.',    'core', 0),
  ('permisos_avanzados','Permisos avanzados','Roles y permisos por sucursal/operación.',   'core', 0),
  ('reportes_avanzados','Reportes avanzados','Reportes configurables y exportables.',      'core', 0),
  -- Addons
  ('agente_ia',      'Agente IA',            'Asistente IA para decisiones operativas.',   'addon', 99),
  ('ecommerce',      'E-commerce',           'Tienda online conectada al inventario.',     'addon', 49),
  ('geolocalizacion','Geolocalización',      'Tracking de vendedores y rutas.',            'addon', 29),
  ('notificaciones', 'Notificaciones',       'WhatsApp, SMS, email automáticos.',          'addon', 19),
  ('analitica_avanzada','Analítica avanzada','BI, cohortes, predicciones.',                'addon', 49),
  ('facturacion_siat','Facturación SIAT',    'Facturación electrónica Bolivia (SIAT).',    'addon', 39),
  ('seguridad_avanzada','Seguridad por dispositivo/IP','Restricción de acceso por dispositivo o IP.','addon', 19)
on conflict (codigo) do update set
  nombre       = excluded.nombre,
  descripcion  = excluded.descripcion,
  categoria    = excluded.categoria,
  precio_addon = excluded.precio_addon;


-- -----------------------------------------------------------------------------
-- PLANES
-- -----------------------------------------------------------------------------
insert into public.planes (codigo, nombre, descripcion, precio_mensual, moneda, orden) values
  ('basico',
   'Básico',
   'Inventario, productos, stock, movimientos y reportes básicos.',
   199, 'BOB', 1),
  ('profesional',
   'Profesional',
   'Todo lo del Básico + ventas, clientes, compras y dashboard.',
   499, 'BOB', 2),
  ('distribuidora',
   'Distribuidora',
   'Profesional + vendedores en campo y control comercial.',
   899, 'BOB', 3),
  ('empresarial',
   'Empresarial',
   'Distribuidora + multi-sucursal, crédito, permisos avanzados y reportes avanzados.',
   1499, 'BOB', 4)
on conflict (codigo) do update set
  nombre         = excluded.nombre,
  descripcion    = excluded.descripcion,
  precio_mensual = excluded.precio_mensual,
  moneda         = excluded.moneda,
  orden          = excluded.orden;


-- -----------------------------------------------------------------------------
-- MAPEO PLAN ↔ MÓDULOS
-- Cada plan incluye sus módulos + los del nivel anterior.
-- -----------------------------------------------------------------------------

-- Limpia mapeo previo para reidempotencia
delete from public.plan_modulos
 where plan_id in (select id from public.planes
                    where codigo in ('basico','profesional','distribuidora','empresarial'));

-- Básico
insert into public.plan_modulos (plan_id, modulo_id)
select p.id, m.id
  from public.planes p, public.modulos m
 where p.codigo = 'basico'
   and m.codigo in ('inventario','reportes_basicos');

-- Profesional = Básico + ventas/clientes/compras/dashboard
insert into public.plan_modulos (plan_id, modulo_id)
select p.id, m.id
  from public.planes p, public.modulos m
 where p.codigo = 'profesional'
   and m.codigo in ('inventario','reportes_basicos','ventas','clientes','compras','dashboard');

-- Distribuidora = Profesional + vendedores + control comercial
insert into public.plan_modulos (plan_id, modulo_id)
select p.id, m.id
  from public.planes p, public.modulos m
 where p.codigo = 'distribuidora'
   and m.codigo in ('inventario','reportes_basicos','ventas','clientes','compras','dashboard',
                    'vendedores','control_comercial');

-- Empresarial = Distribuidora + multisucursal + crédito + permisos + reportes avanzados
insert into public.plan_modulos (plan_id, modulo_id)
select p.id, m.id
  from public.planes p, public.modulos m
 where p.codigo = 'empresarial'
   and m.codigo in ('inventario','reportes_basicos','ventas','clientes','compras','dashboard',
                    'vendedores','control_comercial',
                    'multisucursal','credito','permisos_avanzados','reportes_avanzados');

commit;

-- =============================================================================
-- Verificación rápida (opcional, ejecuta a mano):
--
-- select p.codigo as plan, count(*) as modulos_incluidos
--   from public.planes p
--   join public.plan_modulos pm on pm.plan_id = p.id
--  group by p.codigo
--  order by p.orden;
--
-- Resultado esperado:
--   basico        | 2
--   profesional   | 6
--   distribuidora | 8
--   empresarial   | 12
-- =============================================================================
