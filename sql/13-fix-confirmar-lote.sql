-- =============================================================================
-- 13-fix-confirmar-lote.sql
-- Corrige la función confirmar_lote: el INSERT de productos nuevos faltaba
-- incluir unidad_id (NOT NULL). Ahora toma la primera unidad activa de la
-- empresa como default.
-- Ejecutar una sola vez (idempotente por ser CREATE OR REPLACE).
-- =============================================================================

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
  v_unidad_id  uuid;
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

  -- Obtener unidad de medida por defecto (primera activa de la empresa)
  select id into v_unidad_id
    from public.unidades_medida
   where empresa_id = v_empresa_id and activo = true
   order by created_at
   limit 1;

  if v_unidad_id is null then
    raise exception 'no hay unidad de medida configurada para la empresa';
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
      insert into public.productos
        (empresa_id, sku, nombre, marca, descripcion,
         unidad_id,
         precio_compra, precio_venta,
         precio_mecanico, precio_mayor,
         stock_minimo, aplicacion, medidas,
         peso, modelos, anio_desde, anio_hasta,
         controla_stock, created_by, updated_by)
      values
        (v_empresa_id, v_item.sku, v_item.nombre, v_item.marca, v_item.descripcion,
         v_unidad_id,
         coalesce(v_item.precio_real, 0), coalesce(v_item.precio_unitario, 0),
         v_item.precio_mecanico, v_item.precio_mayor,
         coalesce(v_item.stock_minimo, 0),
         v_item.aplicacion, v_item.medidas, v_item.peso, v_item.modelos,
         v_item.anio_desde, v_item.anio_hasta, true, v_user_id, v_user_id)
      returning id into v_prod_id;
    else
      -- Actualizar datos del producto existente con la nueva info del lote
      update public.productos
         set precio_compra   = coalesce(v_item.precio_real,      precio_compra),
             precio_venta    = coalesce(v_item.precio_unitario,  precio_venta),
             precio_mecanico = coalesce(v_item.precio_mecanico,  precio_mecanico),
             precio_mayor    = coalesce(v_item.precio_mayor,     precio_mayor),
             marca           = coalesce(v_item.marca,            marca),
             aplicacion      = coalesce(v_item.aplicacion,       aplicacion),
             medidas         = coalesce(v_item.medidas,          medidas),
             peso            = coalesce(v_item.peso,             peso),
             modelos         = coalesce(v_item.modelos,          modelos),
             anio_desde      = coalesce(v_item.anio_desde,       anio_desde),
             anio_hasta      = coalesce(v_item.anio_hasta,       anio_hasta),
             updated_by      = v_user_id
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
