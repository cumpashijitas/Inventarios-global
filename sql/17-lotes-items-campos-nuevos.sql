-- =============================================================================
-- 17-lotes-items-campos-nuevos.sql
-- Agrega 6 columnas nuevas a lotes_items para sincronizar con tabla productos
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

alter table public.lotes_items
  add column if not exists codigo_universal text,
  add column if not exists procedencia      text,
  add column if not exists costo_caja       numeric(14,4),
  add column if not exists industria        text,
  add column if not exists motor            text,
  add column if not exists precio_mayorista numeric(14,4);  -- mapea a precio_real en productos

comment on column public.lotes_items.codigo_universal is 'Código universal / OEM';
comment on column public.lotes_items.procedencia      is 'País o región de origen';
comment on column public.lotes_items.costo_caja       is 'Costo de compra por caja/paquete';
comment on column public.lotes_items.industria        is 'Industria o segmento';
comment on column public.lotes_items.motor            is 'Motor compatible';
comment on column public.lotes_items.precio_mayorista is 'Precio mayorista (mapea a precio_real en productos)';


-- =============================================================================
-- Actualizar confirmar_lote para que transfiera los campos nuevos a productos
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
begin
  if v_empresa_id is null then
    raise exception 'tenant context not set';
  end if;

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

    if v_prod_id is null then
      select id into v_prod_id from public.productos
       where empresa_id = v_empresa_id and sku = v_item.sku and deleted_at is null
       limit 1;
    end if;

    if v_prod_id is null then
      insert into public.productos
        (empresa_id, sku, nombre, marca, descripcion,
         precio_compra, precio_venta, precio_mecanico, precio_mayor,
         precio_real, costo_caja,
         stock_minimo,
         medidas, modelos,
         codigo_universal, procedencia, industria, motor,
         controla_stock, created_by, updated_by)
      values
        (v_empresa_id, v_item.sku, v_item.nombre, v_item.marca, v_item.descripcion,
         coalesce(v_item.precio_real, 0), coalesce(v_item.precio_unitario, 0),
         v_item.precio_mecanico, v_item.precio_mayor,
         v_item.precio_mayorista, v_item.costo_caja,
         coalesce(v_item.stock_minimo, 0),
         v_item.medidas, v_item.modelos,
         v_item.codigo_universal, v_item.procedencia, v_item.industria, v_item.motor,
         true, v_user_id, v_user_id)
      returning id into v_prod_id;
    else
      update public.productos
         set precio_compra     = coalesce(v_item.precio_real,      precio_compra),
             precio_venta      = coalesce(v_item.precio_unitario,  precio_venta),
             precio_mecanico   = coalesce(v_item.precio_mecanico,  precio_mecanico),
             precio_mayor      = coalesce(v_item.precio_mayor,     precio_mayor),
             precio_real       = coalesce(v_item.precio_mayorista, precio_real),
             costo_caja        = coalesce(v_item.costo_caja,       costo_caja),
             marca             = coalesce(v_item.marca,            marca),
             medidas           = coalesce(v_item.medidas,          medidas),
             modelos           = coalesce(v_item.modelos,          modelos),
             codigo_universal  = coalesce(v_item.codigo_universal, codigo_universal),
             procedencia       = coalesce(v_item.procedencia,      procedencia),
             industria         = coalesce(v_item.industria,        industria),
             motor             = coalesce(v_item.motor,            motor),
             updated_by        = v_user_id
       where id = v_prod_id;
    end if;

    if v_item.cantidad > 0 then
      perform public.registrar_movimiento_stock(
        v_prod_id, v_almacen_id, 'entrada', v_item.cantidad,
        coalesce(v_item.precio_real, 0), 'lote', p_lote_id,
        'Lote de compra ' || p_lote_id::text
      );
    end if;

    update public.lotes_items
       set procesado = true, producto_id = v_prod_id
     where id = v_item.id;
  end loop;

  update public.lotes_compra
     set estado = 'confirmado', confirmado_en = now(), confirmado_por = v_user_id
   where id = p_lote_id and empresa_id = v_empresa_id;
end;
$$;

grant execute on function public.confirmar_lote(uuid) to app_user;
