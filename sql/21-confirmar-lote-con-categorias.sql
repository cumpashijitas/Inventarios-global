-- =============================================================================
-- 21-confirmar-lote-con-categorias.sql
-- Actualiza confirmar_lote para:
--   1. Asignar categoria_id buscando por nombre exacto en la tabla categorias.
--   2. Al actualizar producto existente, también actualizar categoria_id
--      si el ítem trae categoría y el producto no tenía una asignada.
--   3. Incluir campos nuevos: codigo_universal, procedencia, industria, motor,
--      precio_mayorista (precio_real en productos), costo_caja.
-- Idempotente: CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.confirmar_lote(p_lote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_empresa_id  uuid := public.current_empresa_id();
  v_user_id     uuid := public.current_user_id();
  v_item        record;
  v_prod_id     uuid;
  v_almacen_id  uuid;
  v_unidad_id   uuid;
  v_categoria_id uuid;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'tenant context not set';
  END IF;

  -- Primer almacén activo
  SELECT id INTO v_almacen_id
    FROM public.almacenes
   WHERE empresa_id = v_empresa_id AND activo = true
   ORDER BY created_at LIMIT 1;

  IF v_almacen_id IS NULL THEN
    RAISE EXCEPTION 'no hay almacén activo para recibir el lote';
  END IF;

  -- Primera unidad de medida activa
  SELECT id INTO v_unidad_id
    FROM public.unidades_medida
   WHERE empresa_id = v_empresa_id AND activo = true
   ORDER BY created_at LIMIT 1;

  IF v_unidad_id IS NULL THEN
    RAISE EXCEPTION 'no hay unidad de medida configurada para la empresa';
  END IF;

  FOR v_item IN
    SELECT * FROM public.lotes_items
     WHERE lote_id = p_lote_id AND empresa_id = v_empresa_id AND NOT procesado
  LOOP
    -- ── Resolver categoria_id por nombre ────────────────────────────────────
    v_categoria_id := NULL;
    IF v_item.categoria IS NOT NULL AND trim(v_item.categoria) <> '' THEN
      SELECT id INTO v_categoria_id
        FROM public.categorias
       WHERE empresa_id = v_empresa_id
         AND activo = true
         AND upper(trim(nombre)) = upper(trim(v_item.categoria))
       LIMIT 1;
    END IF;

    -- ── Resolver producto_id ─────────────────────────────────────────────────
    v_prod_id := v_item.producto_id;

    IF v_prod_id IS NULL THEN
      SELECT id INTO v_prod_id FROM public.productos
       WHERE empresa_id = v_empresa_id AND sku = v_item.sku AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    -- ── Crear producto nuevo ─────────────────────────────────────────────────
    IF v_prod_id IS NULL THEN
      INSERT INTO public.productos (
        empresa_id, sku, nombre, marca, descripcion,
        unidad_id, categoria_id,
        precio_compra, precio_venta, precio_mecanico, precio_mayor, precio_real, costo_caja,
        stock_minimo, aplicacion, medidas, peso, modelos, anio_desde, anio_hasta,
        codigo_universal, procedencia, industria, motor,
        controla_stock, created_by, updated_by
      ) VALUES (
        v_empresa_id, v_item.sku, v_item.nombre, v_item.marca, v_item.descripcion,
        v_unidad_id, v_categoria_id,
        COALESCE(v_item.precio_real,      0),
        COALESCE(v_item.precio_unitario,  0),
        v_item.precio_mecanico,
        v_item.precio_mayor,
        v_item.precio_mayorista,
        v_item.costo_caja,
        COALESCE(v_item.stock_minimo, 0),
        v_item.aplicacion, v_item.medidas, v_item.peso, v_item.modelos,
        v_item.anio_desde, v_item.anio_hasta,
        v_item.codigo_universal, v_item.procedencia, v_item.industria, v_item.motor,
        true, v_user_id, v_user_id
      )
      RETURNING id INTO v_prod_id;

    -- ── Actualizar producto existente ────────────────────────────────────────
    ELSE
      UPDATE public.productos SET
        precio_compra    = COALESCE(v_item.precio_real,      precio_compra),
        precio_venta     = COALESCE(v_item.precio_unitario,  precio_venta),
        precio_mecanico  = COALESCE(v_item.precio_mecanico,  precio_mecanico),
        precio_mayor     = COALESCE(v_item.precio_mayor,     precio_mayor),
        precio_real      = COALESCE(v_item.precio_mayorista, precio_real),
        costo_caja       = COALESCE(v_item.costo_caja,       costo_caja),
        marca            = COALESCE(v_item.marca,            marca),
        aplicacion       = COALESCE(v_item.aplicacion,       aplicacion),
        medidas          = COALESCE(v_item.medidas,          medidas),
        peso             = COALESCE(v_item.peso,             peso),
        modelos          = COALESCE(v_item.modelos,          modelos),
        anio_desde       = COALESCE(v_item.anio_desde,       anio_desde),
        anio_hasta       = COALESCE(v_item.anio_hasta,       anio_hasta),
        codigo_universal = COALESCE(v_item.codigo_universal, codigo_universal),
        procedencia      = COALESCE(v_item.procedencia,      procedencia),
        industria        = COALESCE(v_item.industria,        industria),
        motor            = COALESCE(v_item.motor,            motor),
        -- Asignar categoria solo si el producto no tenía una
        categoria_id     = COALESCE(categoria_id, v_categoria_id),
        updated_by       = v_user_id
       WHERE id = v_prod_id;
    END IF;

    -- ── Registrar entrada de stock ───────────────────────────────────────────
    IF v_item.cantidad > 0 THEN
      PERFORM public.registrar_movimiento_stock(
        v_prod_id, v_almacen_id, 'entrada', v_item.cantidad,
        COALESCE(v_item.precio_real, 0), 'lote', p_lote_id,
        'Lote de compra ' || p_lote_id::text
      );
    END IF;

    -- Marcar ítem procesado
    UPDATE public.lotes_items
       SET procesado = true, producto_id = v_prod_id
     WHERE id = v_item.id;

  END LOOP;

  -- Cerrar lote
  UPDATE public.lotes_compra
     SET estado = 'confirmado', confirmado_en = now(), confirmado_por = v_user_id
   WHERE id = p_lote_id AND empresa_id = v_empresa_id;

END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_lote(uuid) TO app_user;
