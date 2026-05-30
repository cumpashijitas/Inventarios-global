-- =============================================================================
-- 06-seed-extension.sql — Datos de ejemplo para nuevas tablas
-- Ejecutar DESPUÉS de 05-rls-extension.sql y 03-seed.sql (que crea la empresa demo)
-- =============================================================================
--
-- NOTA: Este script usa la empresa demo creada en 03-seed.sql.
--       Ajusta el UUID de empresa_demo según el resultado de 03-seed.sql.
--       O usa este bloque DO $$ ... $$ para buscarlo automáticamente.
-- =============================================================================

do $$
declare
  v_empresa_id   uuid;
  v_admin_rol_id uuid;
  v_almacen_id   uuid;
  v_cat_filtros  uuid;
  v_cat_frenos   uuid;
  v_cat_electrico uuid;
  v_cat_motor    uuid;
  v_unidad_id    uuid;
  v_prov1_id     uuid;
  v_prov2_id     uuid;
  v_cli1_id      uuid;
  v_cli2_id      uuid;
  v_prod1_id     uuid;
  v_prod2_id     uuid;
  v_prod3_id     uuid;
begin
  -- Buscar empresa demo
  select id into v_empresa_id from public.empresas
   where razon_social ilike '%demo%' or razon_social ilike '%test%'
   order by created_at limit 1;

  if v_empresa_id is null then
    raise notice 'No se encontró empresa demo. Crea una empresa primero con 03-seed.sql y 99-bootstrap-primer-usuario.sql';
    return;
  end if;

  raise notice 'Usando empresa: %', v_empresa_id;

  -- Setear contexto RLS para insertar
  perform set_config('app.current_empresa_id', v_empresa_id::text, true);

  -- Obtener almacén central
  select id into v_almacen_id from public.almacenes
   where empresa_id = v_empresa_id and activo = true order by created_at limit 1;

  -- Obtener unidad de medida "UN"
  select id into v_unidad_id from public.unidades_medida
   where empresa_id = v_empresa_id and codigo = 'UN' limit 1;

  -- Si no hay unidad, crear
  if v_unidad_id is null then
    insert into public.unidades_medida (empresa_id, codigo, nombre, decimales)
    values (v_empresa_id, 'UN', 'Unidad', 0) returning id into v_unidad_id;
  end if;

  -- Crear categorías si no existen
  insert into public.categorias (empresa_id, nombre, orden)
  values (v_empresa_id, 'Filtros', 1) on conflict do nothing returning id into v_cat_filtros;
  if v_cat_filtros is null then
    select id into v_cat_filtros from public.categorias where empresa_id = v_empresa_id and nombre = 'Filtros' limit 1;
  end if;

  insert into public.categorias (empresa_id, nombre, orden)
  values (v_empresa_id, 'Frenos', 2) on conflict do nothing returning id into v_cat_frenos;
  if v_cat_frenos is null then
    select id into v_cat_frenos from public.categorias where empresa_id = v_empresa_id and nombre = 'Frenos' limit 1;
  end if;

  insert into public.categorias (empresa_id, nombre, orden)
  values (v_empresa_id, 'Eléctrico', 3) on conflict do nothing returning id into v_cat_electrico;
  if v_cat_electrico is null then
    select id into v_cat_electrico from public.categorias where empresa_id = v_empresa_id and nombre = 'Eléctrico' limit 1;
  end if;

  -- ── Proveedores ──────────────────────────────────────────────────────────
  insert into public.proveedores
    (empresa_id, codigo, razon_social, nombre_contacto, email, telefono, ciudad, categoria)
  values
    (v_empresa_id, 'PROV-001', 'Repuestos Andinos SA', 'Carlos Mendez', 'contacto@repuestosandinos.com', '591-2-2123456', 'La Paz', 'repuestos'),
    (v_empresa_id, 'PROV-002', 'Importadora Automotriz', 'Maria Torres', 'ventas@importautomotriz.com', '591-3-3456789', 'Santa Cruz', 'repuestos'),
    (v_empresa_id, 'PROV-003', 'Lubricantes Premium', 'Juan Flores', 'juan@lubricantespremium.com', '591-4-4567890', 'Cochabamba', 'lubricantes'),
    (v_empresa_id, 'PROV-004', 'Frenos del Ecuador', 'Ana Salazar', 'ana@frenosecuador.com', '593-2-2234567', 'Quito', 'repuestos')
  on conflict (empresa_id, razon_social) do nothing;

  select id into v_prov1_id from public.proveedores
   where empresa_id = v_empresa_id and codigo = 'PROV-001' limit 1;
  select id into v_prov2_id from public.proveedores
   where empresa_id = v_empresa_id and codigo = 'PROV-002' limit 1;

  -- ── Clientes ─────────────────────────────────────────────────────────────
  insert into public.clientes
    (empresa_id, codigo, nombre, tipo, email, celular, ciudad, descuento_pct)
  values
    (v_empresa_id, 'CLI-001', 'Taller Mecánica Suárez', 'mecanico', 'mecanica@suarez.com', '591-70123456', 'La Paz', 5.00),
    (v_empresa_id, 'CLI-002', 'Distribuidora AutoPartes Norte', 'mayorista', 'autopartes@norte.com', '591-71234567', 'El Alto', 10.00),
    (v_empresa_id, 'CLI-003', 'Pedro Quispe', 'particular', null, '591-72345678', 'La Paz', 0.00),
    (v_empresa_id, 'CLI-004', 'Taller Los Andes', 'mecanico', 'losandes@taller.com', '591-73456789', 'Cochabamba', 5.00)
  on conflict do nothing;

  -- ── Productos de ejemplo (con todos los campos nuevos) ───────────────────
  insert into public.productos
    (empresa_id, sku, nombre, categoria_id, unidad_id, marca,
     precio_compra, precio_venta, precio_mecanico, precio_mayor,
     stock_minimo, stock_maximo, controla_stock,
     proveedor_id, aplicacion, medidas, peso, modelos,
     anio_desde, anio_hasta, descripcion)
  values
    (v_empresa_id, 'FLT-ACE-TOY-001', 'Filtro de Aceite Toyota', v_cat_filtros, v_unidad_id, 'Toyota Genuine',
     11.50, 18.50, 15.20, 13.80, 10, 100, true,
     v_prov1_id, 'Motor 1.8L / 2.0L', 'Ø65mm H:75mm', 0.25, 'Corolla, RAV4, Yaris',
     2015, 2023, 'Filtro de aceite original Toyota para motores de combustión interna'),
    (v_empresa_id, 'FRN-PAS-DEL-002', 'Pastillas de Freno Delanteras', v_cat_frenos, v_unidad_id, 'Brembo',
     42.00, 65.00, 52.00, 48.50, 12, 60, true,
     v_prov2_id, 'Eje delantero', '140x55x17mm', 0.80, 'Corolla, Civic, Sentra',
     2018, 2024, 'Pastillas de freno cerámicas de alto rendimiento con bajo nivel de polvo'),
    (v_empresa_id, 'MOT-BUJ-NGK-007', 'Bujías NGK Platino Set 4', v_cat_electrico, v_unidad_id, 'NGK',
     28.00, 42.00, 35.00, 32.00, 8, 80, true,
     v_prov1_id, 'Motor gasolina 4cil', 'M14x1.25 L:26mm', 0.20, 'Universal 4 cilindros',
     2010, 2024, 'Bujías de platino doble para mayor duración y mejor combustión'),
    (v_empresa_id, 'ELE-BAT-60A-004', 'Batería 12V 60Ah Bosch', v_cat_electrico, v_unidad_id, 'Bosch S4',
     98.00, 145.00, 125.00, 118.00, 4, 20, true,
     v_prov2_id, 'Sistema eléctrico 12V', '242x175x190mm', 14.50, 'Sedán / SUV / Pickup mediano',
     2012, 2024, 'Batería de arranque libre de mantenimiento con tecnología AGM')
  on conflict (empresa_id, sku) do nothing;

  -- ── Stock inicial ─────────────────────────────────────────────────────────
  if v_almacen_id is not null then
    -- Usar la función segura para registrar entradas
    perform set_config('app.current_empresa_id', v_empresa_id::text, true);
    perform set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true);

    for v_prod1_id in
      select id from public.productos
       where empresa_id = v_empresa_id and deleted_at is null
         and not exists (
           select 1 from public.stock_actual sa
            where sa.producto_id = productos.id and sa.almacen_id = v_almacen_id
         )
    loop
      begin
        perform public.registrar_movimiento_stock(
          v_prod1_id, v_almacen_id, 'entrada',
          case when (random() * 50)::int + 5 > 0 then (random() * 50)::int + 5 else 10 end,
          (select precio_compra from public.productos where id = v_prod1_id),
          'seed', null, 'Stock inicial seed'
        );
      exception when others then
        null; -- ignorar errores de stock en seed
      end;
    end loop;
  end if;

  raise notice 'Seed extension completado para empresa: %', v_empresa_id;
end;
$$;
