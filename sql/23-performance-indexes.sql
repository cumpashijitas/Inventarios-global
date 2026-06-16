-- Índices de performance — ejecutar en Supabase SQL Editor
-- Cada sentencia por separado (CONCURRENTLY no puede ir dentro de una transacción)

-- Productos: búsqueda por nombre y sku (ya se usan en LIKE queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_nombre_lower
  ON public.productos (empresa_id, lower(nombre))
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_sku_lower
  ON public.productos (empresa_id, lower(sku))
  WHERE deleted_at IS NULL;

-- Productos: FK usadas en JOINs sin índice propio
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_categoria_id
  ON public.productos (categoria_id)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_proveedor_id
  ON public.productos (proveedor_id)
  WHERE deleted_at IS NULL;

-- Stock: almacen_id sin índice
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_actual_almacen_id
  ON public.stock_actual (almacen_id);

-- Ventas: listado por fecha (orden más común)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ventas_empresa_fecha
  ON public.ventas (empresa_id, fecha DESC);

-- Ventas: búsqueda por cliente_nombre
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ventas_cliente_nombre_lower
  ON public.ventas (empresa_id, lower(cliente_nombre))
  WHERE cliente_nombre IS NOT NULL;

-- Cotizaciones: listado por fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cotizaciones_empresa_fecha
  ON public.cotizaciones (empresa_id, fecha DESC)
  WHERE deleted_at IS NULL;

-- Ventas items: búsqueda por venta_id (para listar items de una venta)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ventas_items_venta_id
  ON public.ventas_items (venta_id);

-- Cotizaciones items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cotizaciones_items_cotizacion_id
  ON public.cotizaciones_items (cotizacion_id);

-- Devoluciones: listado por empresa
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devoluciones_empresa_created
  ON public.devoluciones (empresa_id, created_at DESC);

-- Auditoria: evitar seq scan en dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditoria_empresa_created
  ON public.auditoria (empresa_id, created_at DESC);
