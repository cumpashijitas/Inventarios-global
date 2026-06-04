-- =============================================================================
-- 18-devoluciones.sql
-- Tabla de devoluciones / cambios de producto
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

create table if not exists public.devoluciones (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  venta_id              uuid not null references public.ventas(id),
  venta_item_id         uuid references public.ventas_items(id),   -- item específico de la venta
  atendido_por          uuid,                                       -- user_id del empleado
  motivo                text not null,   -- 'error_nuestro' | 'defecto_fabrica' | 'cambio_medida' | 'otro'
  notas                 text,

  -- Producto devuelto (entra al stock)
  producto_devuelto_id  uuid not null references public.productos(id),
  cantidad_devuelta     numeric(14,4) not null,
  monto_devuelto        numeric(14,4) not null,  -- precio real de la venta * cantidad_devuelta

  -- Producto nuevo (sale del stock) — nullable si es solo reembolso
  producto_nuevo_id     uuid references public.productos(id),
  cantidad_nueva        numeric(14,4),
  monto_cobrado         numeric(14,4) not null default 0,

  -- Cálculo: positivo = cliente paga, negativo = negocio devuelve, 0 = cambio exacto
  diferencia            numeric(14,4) not null,

  -- Referencia al movimiento de caja generado (si aplica)
  movimiento_caja_id    uuid references public.caja_movimientos(id) on delete set null,

  created_at            timestamptz not null default now(),
  created_by            uuid
);

create index ix_devoluciones_empresa     on public.devoluciones(empresa_id, created_at desc);
create index ix_devoluciones_venta       on public.devoluciones(venta_id);

comment on table  public.devoluciones                    is 'Registro de devoluciones y cambios de producto';
comment on column public.devoluciones.diferencia         is 'monto_cobrado - monto_devuelto: + cliente paga, - negocio devuelve';
comment on column public.devoluciones.movimiento_caja_id is 'Movimiento de caja generado automáticamente si diferencia != 0';
