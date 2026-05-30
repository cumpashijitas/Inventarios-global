-- =============================================================================
-- 04-schema-extension.sql — Extensión del schema base
-- Nuevas tablas: proveedores, clientes, ventas, cotizaciones, caja, lotes
-- Columnas adicionales en productos
-- =============================================================================
-- Ejecutar DESPUÉS de 01-schema.sql, 02-rls.sql y 03-seed.sql
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. EXTENSIÓN DE TABLA productos
--    Nuevas columnas para la pantalla de Inventario y Carga Masiva
-- -----------------------------------------------------------------------------
alter table public.productos
  add column if not exists marca            text,
  add column if not exists precio_mecanico  numeric(14,4),
  add column if not exists precio_mayor     numeric(14,4),
  add column if not exists proveedor_id     uuid,          -- FK se agrega después de crear la tabla
  add column if not exists aplicacion       text,          -- e.g. "Motor 1.8L / 2.0L"
  add column if not exists medidas          text,          -- e.g. "Ø65mm H:75mm"
  add column if not exists peso             numeric(10,4), -- kg
  add column if not exists modelos          text,          -- e.g. "Corolla, Civic, Sentra"
  add column if not exists anio_desde       smallint,
  add column if not exists anio_hasta       smallint,
  add column if not exists ubicacion        text;          -- e.g. "Estante A-3"

comment on column public.productos.precio_mecanico  is 'Precio especial para mecánicos';
comment on column public.productos.precio_mayor     is 'Precio mayorista';
comment on column public.productos.aplicacion       is 'Compatibilidad técnica del repuesto';
comment on column public.productos.modelos          is 'Modelos de vehículo compatibles (texto libre o JSON)';


-- -----------------------------------------------------------------------------
-- 2. PROVEEDORES
-- -----------------------------------------------------------------------------
create table if not exists public.proveedores (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  codigo          text,
  razon_social    text not null,
  nombre_contacto text,
  email           citext,
  telefono        text,
  celular         text,
  direccion       text,
  ciudad          text,
  pais            char(2) default 'BO',
  nit             text,
  categoria       text default 'general',  -- 'repuestos','lubricantes','herramientas','general'
  banco           text,
  cuenta_bancaria text,
  notas           text,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz,
  unique (empresa_id, razon_social)
);
create index ix_proveedores_empresa on public.proveedores(empresa_id) where deleted_at is null;
create trigger trg_proveedores_updated_at before update on public.proveedores
  for each row execute function public.set_updated_at();

-- Ahora añadir FK en productos → proveedores
alter table public.productos
  add constraint fk_productos_proveedor
  foreign key (proveedor_id) references public.proveedores(id) on delete set null;


-- -----------------------------------------------------------------------------
-- 3. CLIENTES
-- -----------------------------------------------------------------------------
create table if not exists public.clientes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  codigo          text,
  nombre          text not null,
  tipo            text not null default 'particular',   -- 'mecanico' | 'mayorista' | 'particular'
  email           citext,
  telefono        text,
  celular         text,
  direccion       text,
  ciudad          text,
  pais            char(2) default 'BO',
  nit             text,
  limite_credito  numeric(14,4) default 0,
  dias_credito    int default 0,
  descuento_pct   numeric(7,4) default 0,              -- % descuento fijo para este cliente
  notas           text,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz
);
create index ix_clientes_empresa on public.clientes(empresa_id) where deleted_at is null;
create index ix_clientes_nombre on public.clientes using gin (empresa_id, nombre gin_trgm_ops);
create trigger trg_clientes_updated_at before update on public.clientes
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. VENTAS
-- -----------------------------------------------------------------------------
create table if not exists public.ventas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  numero          text not null,                -- 'V-2026-0001' (generado por la app)
  cliente_id      uuid references public.clientes(id) on delete set null,
  cliente_nombre  text,                         -- snapshot del nombre al momento de la venta
  cliente_nit     text,
  fecha           date not null default current_date,
  estado          text not null default 'completada',  -- 'borrador' | 'completada' | 'anulada'
  metodo_pago     text not null default 'efectivo',    -- 'efectivo' | 'tarjeta_credito' | 'tarjeta_debito' | 'transferencia' | 'mixto'
  subtotal        numeric(14,4) not null default 0,
  descuento_pct   numeric(7,4) default 0,
  descuento_monto numeric(14,4) default 0,
  impuesto_pct    numeric(7,4) default 0,
  impuesto_monto  numeric(14,4) default 0,
  total           numeric(14,4) not null default 0,
  monto_pagado    numeric(14,4) default 0,
  cambio          numeric(14,4) default 0,
  almacen_id      uuid references public.almacenes(id),
  caja_sesion_id  uuid,                          -- FK a caja_sesiones, se agrega después
  notas           text,
  anulada_en      timestamptz,
  anulada_por     uuid,
  motivo_anulacion text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  unique (empresa_id, numero)
);
create index ix_ventas_empresa_fecha on public.ventas(empresa_id, fecha desc) where anulada_en is null;
create index ix_ventas_cliente on public.ventas(empresa_id, cliente_id);
create trigger trg_ventas_updated_at before update on public.ventas
  for each row execute function public.set_updated_at();


-- 4.1 Ítems de venta (líneas)
create table if not exists public.ventas_items (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  venta_id        uuid not null references public.ventas(id) on delete cascade,
  producto_id     uuid references public.productos(id) on delete set null,
  sku             text not null,                -- snapshot
  nombre          text not null,               -- snapshot
  cantidad        numeric(14,4) not null,
  precio_unitario numeric(14,4) not null,
  descuento_pct   numeric(7,4) default 0,
  subtotal        numeric(14,4) not null,
  costo_unitario  numeric(14,4) default 0,     -- costo al momento de la venta (margen)
  created_at      timestamptz not null default now()
);
create index ix_ventas_items_venta on public.ventas_items(venta_id);
create index ix_ventas_items_producto on public.ventas_items(empresa_id, producto_id);


-- -----------------------------------------------------------------------------
-- 5. COTIZACIONES
-- -----------------------------------------------------------------------------
create table if not exists public.cotizaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  numero          text not null,                -- 'COT-2026-0001'
  cliente_id      uuid references public.clientes(id) on delete set null,
  cliente_nombre  text,
  fecha           date not null default current_date,
  vigencia_dias   int not null default 15,
  fecha_vence     date generated always as (fecha + vigencia_dias * interval '1 day') stored,
  estado          text not null default 'pendiente',  -- 'pendiente' | 'aprobada' | 'rechazada' | 'vencida' | 'convertida'
  subtotal        numeric(14,4) not null default 0,
  descuento_monto numeric(14,4) default 0,
  total           numeric(14,4) not null default 0,
  venta_id        uuid references public.ventas(id) on delete set null,  -- si se convirtió
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz,
  unique (empresa_id, numero)
);
create index ix_cotizaciones_empresa_fecha on public.cotizaciones(empresa_id, fecha desc);
create trigger trg_cotizaciones_updated_at before update on public.cotizaciones
  for each row execute function public.set_updated_at();


-- 5.1 Ítems de cotización
create table if not exists public.cotizaciones_items (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  cotizacion_id   uuid not null references public.cotizaciones(id) on delete cascade,
  producto_id     uuid references public.productos(id) on delete set null,
  sku             text not null,
  nombre          text not null,
  cantidad        numeric(14,4) not null,
  precio_unitario numeric(14,4) not null,
  descuento_pct   numeric(7,4) default 0,
  subtotal        numeric(14,4) not null,
  created_at      timestamptz not null default now()
);
create index ix_cotizaciones_items_cot on public.cotizaciones_items(cotizacion_id);


-- -----------------------------------------------------------------------------
-- 6. CAJA
-- -----------------------------------------------------------------------------

-- 6.1 Sesión de caja (turno de cajero)
create table if not exists public.caja_sesiones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  codigo          text not null,                -- 'CAJA-001'
  cajero_id       uuid,                         -- user_id del cajero
  cajero_nombre   text,
  estado          text not null default 'abierta',  -- 'abierta' | 'cerrada'
  saldo_inicial   numeric(14,4) not null default 0,
  saldo_final     numeric(14,4),
  saldo_esperado  numeric(14,4),                -- calculado al cierre
  diferencia      numeric(14,4),
  abierta_en      timestamptz not null default now(),
  cerrada_en      timestamptz,
  notas_cierre    text,
  almacen_id      uuid references public.almacenes(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index ix_caja_sesiones_empresa on public.caja_sesiones(empresa_id, abierta_en desc);
create trigger trg_caja_sesiones_updated_at before update on public.caja_sesiones
  for each row execute function public.set_updated_at();

-- FK inversa: ventas → caja_sesion
alter table public.ventas
  add constraint fk_ventas_caja_sesion
  foreign key (caja_sesion_id) references public.caja_sesiones(id) on delete set null;


-- 6.2 Movimientos de caja (cada ingreso / retiro / venta)
create table if not exists public.caja_movimientos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  sesion_id       uuid not null references public.caja_sesiones(id) on delete cascade,
  tipo            text not null,                -- 'apertura' | 'venta' | 'ingreso' | 'retiro' | 'cierre'
  referencia      text,                         -- número de venta, descripción del ingreso/retiro
  referencia_id   uuid,                         -- venta_id si aplica
  metodo_pago     text default 'efectivo',      -- igual que ventas.metodo_pago
  monto           numeric(14,4) not null,       -- positivo = entrada, negativo = salida
  saldo_acumulado numeric(14,4) not null,
  usuario_id      uuid,
  notas           text,
  created_at      timestamptz not null default now()
);
create index ix_caja_movimientos_sesion on public.caja_movimientos(sesion_id, created_at);
create index ix_caja_movimientos_empresa on public.caja_movimientos(empresa_id, created_at desc);


-- -----------------------------------------------------------------------------
-- 7. LOTES DE COMPRA (Carga Masiva)
-- -----------------------------------------------------------------------------
create table if not exists public.lotes_compra (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  referencia      text not null,                -- 'OC-2026-001'
  proveedor_id    uuid references public.proveedores(id) on delete set null,
  proveedor_nombre text,                        -- snapshot
  fecha           date not null default current_date,
  estado          text not null default 'activo',  -- 'activo' | 'confirmado' | 'cerrado' | 'anulado'
  productos_count int not null default 0,
  total_estimado  numeric(14,4) default 0,
  notas           text,
  confirmado_en   timestamptz,
  confirmado_por  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz,
  unique (empresa_id, referencia)
);
create trigger trg_lotes_compra_updated_at before update on public.lotes_compra
  for each row execute function public.set_updated_at();


-- 7.1 Ítems del lote (filas de la planilla)
create table if not exists public.lotes_items (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  lote_id         uuid not null references public.lotes_compra(id) on delete cascade,
  producto_id     uuid references public.productos(id) on delete set null,  -- null = producto nuevo

  -- Datos del producto (para crear/actualizar)
  sku             text not null,
  nombre          text not null,
  categoria       text,
  marca           text,

  -- Precios
  precio_real     numeric(14,4),               -- precio_compra
  precio_unitario numeric(14,4),               -- precio_venta público
  precio_mecanico numeric(14,4),
  precio_mayor    numeric(14,4),

  -- Stock
  cantidad        numeric(14,4) not null default 0,
  stock_minimo    numeric(14,4) default 0,
  ubicacion       text,

  -- Campos extendidos (pantalla de carga masiva)
  proveedor       text,
  aplicacion      text,
  medidas         text,
  peso            numeric(10,4),
  modelos         text,
  anio_desde      smallint,
  anio_hasta      smallint,
  descripcion     text,

  -- Control
  procesado       boolean not null default false,  -- true cuando se confirmó y actualizó stock
  error_msg       text,                           -- si hubo error al procesar
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index ix_lotes_items_lote on public.lotes_items(lote_id);
create index ix_lotes_items_sku on public.lotes_items(empresa_id, sku);
create trigger trg_lotes_items_updated_at before update on public.lotes_items
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 8. VISTA ÚTIL: stock consolidado por producto (suma todos los almacenes)
-- -----------------------------------------------------------------------------
create or replace view public.v_stock_consolidado as
select
  sa.empresa_id,
  sa.producto_id,
  p.sku,
  p.nombre,
  p.marca,
  p.categoria_id,
  p.unidad_id,
  p.precio_compra,
  p.precio_venta,
  p.precio_mecanico,
  p.precio_mayor,
  p.stock_minimo,
  p.stock_maximo,
  p.activo,
  sum(sa.cantidad)        as stock_total,
  avg(sa.costo_promedio)  as costo_promedio_avg
from public.stock_actual sa
join public.productos p on p.id = sa.producto_id
where p.deleted_at is null
group by
  sa.empresa_id, sa.producto_id,
  p.sku, p.nombre, p.marca, p.categoria_id, p.unidad_id,
  p.precio_compra, p.precio_venta, p.precio_mecanico, p.precio_mayor,
  p.stock_minimo, p.stock_maximo, p.activo;


-- -----------------------------------------------------------------------------
-- 9. FUNCIÓN: confirmar_lote
-- Cuando se aprueba un lote de compra:
--   1. Por cada ítem con producto_id → ajusta stock (entrada)
--   2. Por cada ítem sin producto_id y con sku nuevo → crea el producto y luego ajusta
--   3. Marca el lote como 'confirmado'
-- -----------------------------------------------------------------------------
create or replace function public.confirmar_lote(p_lote_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
  v_user_id    uuid := public.current_user_id();
  v_item       record;
  v_prod_id    uuid;
  v_almacen_id uuid;
begin
  if v_empresa_id is null then
    raise exception 'tenant context not set';
  end if;

  -- Obtener primer almacén activo como destino
  select id into v_almacen_id
    from public.almacenes
   where empresa_id = v_empresa_id and activo = true
   order by created_at
   limit 1;

  if v_almacen_id is null then
    raise exception 'no hay almacén activo para recibir el lote';
  end if;

  for v_item in
    select * from public.lotes_items
     where lote_id = p_lote_id and empresa_id = v_empresa_id and not procesado
  loop
    v_prod_id := v_item.producto_id;

    -- Si no tiene producto asociado, intentar encontrar por SKU
    if v_prod_id is null then
      select id into v_prod_id from public.productos
       where empresa_id = v_empresa_id and sku = v_item.sku and deleted_at is null
       limit 1;
    end if;

    -- Si aún no existe, crearlo
    if v_prod_id is null then
      -- Obtener unidad_medida por defecto (UN)
      insert into public.productos
        (empresa_id, sku, nombre, marca, descripcion, precio_compra, precio_venta,
         precio_mecanico, precio_mayor, stock_minimo, aplicacion, medidas,
         peso, modelos, anio_desde, anio_hasta, controla_stock, created_by, updated_by)
      values
        (v_empresa_id, v_item.sku, v_item.nombre, v_item.marca, v_item.descripcion,
         coalesce(v_item.precio_real, 0), coalesce(v_item.precio_unitario, 0),
         v_item.precio_mecanico, v_item.precio_mayor, coalesce(v_item.stock_minimo, 0),
         v_item.aplicacion, v_item.medidas, v_item.peso, v_item.modelos,
         v_item.anio_desde, v_item.anio_hasta, true, v_user_id, v_user_id)
      returning id into v_prod_id;
    else
      -- Actualizar datos del producto existente con la nueva info del lote
      update public.productos
         set precio_compra     = coalesce(v_item.precio_real, precio_compra),
             precio_venta      = coalesce(v_item.precio_unitario, precio_venta),
             precio_mecanico   = coalesce(v_item.precio_mecanico, precio_mecanico),
             precio_mayor      = coalesce(v_item.precio_mayor, precio_mayor),
             marca             = coalesce(v_item.marca, marca),
             aplicacion        = coalesce(v_item.aplicacion, aplicacion),
             medidas           = coalesce(v_item.medidas, medidas),
             peso              = coalesce(v_item.peso, peso),
             modelos           = coalesce(v_item.modelos, modelos),
             anio_desde        = coalesce(v_item.anio_desde, anio_desde),
             anio_hasta        = coalesce(v_item.anio_hasta, anio_hasta),
             updated_by        = v_user_id
       where id = v_prod_id;
    end if;

    -- Registrar entrada de stock
    if v_item.cantidad > 0 then
      perform public.registrar_movimiento_stock(
        v_prod_id, v_almacen_id, 'entrada', v_item.cantidad,
        coalesce(v_item.precio_real, 0), 'lote', p_lote_id,
        'Lote de compra ' || p_lote_id::text
      );
    end if;

    -- Marcar ítem como procesado
    update public.lotes_items
       set procesado = true, producto_id = v_prod_id
     where id = v_item.id;
  end loop;

  -- Cerrar el lote
  update public.lotes_compra
     set estado = 'confirmado', confirmado_en = now(), confirmado_por = v_user_id
   where id = p_lote_id and empresa_id = v_empresa_id;
end;
$$;

grant execute on function public.confirmar_lote(uuid) to app_user;


-- =============================================================================
-- FIN DE LA EXTENSIÓN
-- Siguiente paso: 05-rls-extension.sql para activar RLS en las nuevas tablas.
-- =============================================================================