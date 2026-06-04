-- =============================================================================
-- 16-productos-campos-nuevos.sql
-- Agrega 6 columnas nuevas a la tabla productos
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

alter table public.productos
  add column if not exists codigo_universal text,
  add column if not exists procedencia      text,
  add column if not exists costo_caja       numeric(14,4),
  add column if not exists industria        text,
  add column if not exists motor            text,
  add column if not exists precio_real      numeric(14,4);

comment on column public.productos.codigo_universal is 'Código universal / código OEM del fabricante';
comment on column public.productos.procedencia      is 'País o región de origen del producto';
comment on column public.productos.costo_caja       is 'Costo de compra por caja/paquete';
comment on column public.productos.industria        is 'Industria o segmento (automotriz, industrial, etc.)';
comment on column public.productos.motor            is 'Motor o especificación de motor compatible';
comment on column public.productos.precio_real      is 'Precio mayorista (precio real de venta al distribuidor)';
