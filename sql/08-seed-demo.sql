-- =============================================================================
-- 08-seed-demo.sql — Datos de demostración (repuestos automotrices)
-- =============================================================================
-- Ejecutar en Supabase SQL Editor como service_role / superuser.
-- Idempotente: si ya existen categorías para la empresa, no hace nada.
-- Requiere: bootstrap (99-...) ya ejecutado (debe existir empresa + almacén CENTRAL).
-- =============================================================================

DO $$
DECLARE
  v_emp  uuid;
  v_usr  uuid;
  v_alm  uuid;
  v_uun  uuid;   -- unidad UN (unidades)

  -- categorías
  c_filtros   uuid; c_lubricantes uuid; c_frenos     uuid; c_motor      uuid;
  c_transm    uuid; c_electrico   uuid; c_suspension uuid; c_carroceria uuid;

  -- proveedores
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;

  -- clientes
  cl1 uuid; cl2 uuid; cl3 uuid; cl4 uuid; cl5 uuid;

  -- productos
  pr1 uuid; pr2 uuid; pr3 uuid; pr4 uuid; pr5 uuid;
  pr6 uuid; pr7 uuid; pr8 uuid; pr9 uuid; pr10 uuid;

  -- caja
  v_caja uuid;

  -- ventas
  v1 uuid; v2 uuid; v3 uuid;

  -- cotizaciones
  cot1 uuid; cot2 uuid;

BEGIN

  -- ── 0. Obtener contexto ────────────────────────────────────────────────────
  SELECT id INTO v_emp FROM public.empresas LIMIT 1;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'No hay empresa registrada. Ejecuta 99-bootstrap-primer-usuario.sql primero.';
  END IF;

  SELECT user_id INTO v_usr
    FROM public.usuarios_empresa
   WHERE empresa_id = v_emp
   LIMIT 1;

  SELECT id INTO v_alm
    FROM public.almacenes
   WHERE empresa_id = v_emp AND activo = true
   LIMIT 1;
  IF v_alm IS NULL THEN
    RAISE EXCEPTION 'No hay almacén activo. El bootstrap debería haber creado CENTRAL.';
  END IF;

  SELECT id INTO v_uun
    FROM public.unidades_medida
   WHERE empresa_id = v_emp AND codigo = 'UN'
   LIMIT 1;
  IF v_uun IS NULL THEN
    RAISE EXCEPTION 'Unidad UN no encontrada. El bootstrap debería haberla creado.';
  END IF;

  -- ── Guardia: si ya hay PRODUCTOS, el seed ya corrió completamente ──────────
  IF EXISTS (SELECT 1 FROM public.productos WHERE empresa_id = v_emp LIMIT 1) THEN
    RAISE NOTICE 'Ya existen productos para esta empresa. Seed omitido.';
    RETURN;
  END IF;

  -- Limpiar categorías huérfanas de runs previos fallidos
  DELETE FROM public.categorias WHERE empresa_id = v_emp;

  RAISE NOTICE 'Insertando datos de demo para empresa %...', v_emp;

  -- ── 1. CATEGORÍAS (8) ──────────────────────────────────────────────────────
  INSERT INTO public.categorias (empresa_id, nombre, orden, activo)
  VALUES (v_emp, 'Filtros',        1, true) RETURNING id INTO c_filtros;

  INSERT INTO public.categorias (empresa_id, nombre, orden, activo)
  VALUES (v_emp, 'Lubricantes',    2, true) RETURNING id INTO c_lubricantes;

  INSERT INTO public.categorias (empresa_id, nombre, orden, activo)
  VALUES (v_emp, 'Frenos',         3, true) RETURNING id INTO c_frenos;

  INSERT INTO public.categorias (empresa_id, nombre, orden, activo)
  VALUES (v_emp, 'Motor',          4, true) RETURNING id INTO c_motor;

  INSERT INTO public.categorias (empresa_id, nombre, orden, activo)
  VALUES (v_emp, 'Transmisión',    5, true) RETURNING id INTO c_transm;

  INSERT INTO public.categorias (empresa_id, nombre, orden, activo)
  VALUES (v_emp, 'Eléctrico',      6, true) RETURNING id INTO c_electrico;

  INSERT INTO public.categorias (empresa_id, nombre, orden, activo)
  VALUES (v_emp, 'Suspensión',     7, true) RETURNING id INTO c_suspension;

  INSERT INTO public.categorias (empresa_id, nombre, orden, activo)
  VALUES (v_emp, 'Carrocería',     8, true) RETURNING id INTO c_carroceria;

  RAISE NOTICE '  ✓ 8 categorías';


  -- ── 2. PROVEEDORES (5) ─────────────────────────────────────────────────────
  INSERT INTO public.proveedores
    (empresa_id, codigo, razon_social, nombre_contacto, email, telefono, celular, ciudad, nit, categoria, created_by)
  VALUES
    (v_emp, 'PRV-001', 'Toyota Distribuidor Bolivia S.A.',
     'Roberto Vásquez', 'ventas@toyotabol.com.bo', '04-4123456', '77812345', 'Tarija', '1001234567', 'repuestos', v_usr),
    (v_emp, 'PRV-002', 'Importadora Nissan SRL',
     'Carmen Flores',   'importadora@nissan-srl.bo',  '04-4234567', '77923456', 'La Paz',  '1002345678', 'repuestos', v_usr),
    (v_emp, 'PRV-003', 'Repuestos Premium Ltda',
     'Luis Méndez',     'info@repuestospremium.bo',    '04-4345678', '77034567', 'Santa Cruz', '1003456789', 'general',   v_usr),
    (v_emp, 'PRV-004', 'Lubricantes del Sur S.A.',
     'Ana Torres',      'ventas@lubsur.com.bo',        '04-4456789', '77145678', 'Tarija', '1004567890', 'lubricantes', v_usr),
    (v_emp, 'PRV-005', 'Autopartes China S.R.L.',
     'Jorge Quispe',    'jorge@autoparteschina.bo',    '04-4567890', '77256789', 'Oruro',  '1005678901', 'repuestos', v_usr);

  -- Recuperar IDs por razón social (el RETURNING no funciona con multi-fila en PL/pgSQL)
  SELECT id INTO p1 FROM public.proveedores WHERE empresa_id = v_emp AND razon_social = 'Toyota Distribuidor Bolivia S.A.';
  SELECT id INTO p2 FROM public.proveedores WHERE empresa_id = v_emp AND razon_social = 'Importadora Nissan SRL';
  SELECT id INTO p3 FROM public.proveedores WHERE empresa_id = v_emp AND razon_social = 'Repuestos Premium Ltda';
  SELECT id INTO p4 FROM public.proveedores WHERE empresa_id = v_emp AND razon_social = 'Lubricantes del Sur S.A.';
  SELECT id INTO p5 FROM public.proveedores WHERE empresa_id = v_emp AND razon_social = 'Autopartes China S.R.L.';

  RAISE NOTICE '  ✓ 5 proveedores';


  -- ── 3. CLIENTES (5) ────────────────────────────────────────────────────────
  INSERT INTO public.clientes
    (empresa_id, codigo, nombre, tipo, telefono, celular, ciudad, nit, descuento_pct, created_by)
  VALUES
    (v_emp, 'CLI-001', 'Taller Mecánico San José',     'mecanico',   '04-4111222', '77011222', 'Tarija', '2001111111',  5.00, v_usr),
    (v_emp, 'CLI-002', 'Distribuidora Automotriz Tarija','mayorista', '04-4222333', '77022333', 'Tarija', '2002222222', 10.00, v_usr),
    (v_emp, 'CLI-003', 'Carlos Rodríguez',             'particular', null,         '77033444', 'Tarija', null,           0.00, v_usr),
    (v_emp, 'CLI-004', 'Taller Castro Hermanos',       'mecanico',   '04-4444555', '77044555', 'Tarija', '2004444444',  7.50, v_usr),
    (v_emp, 'CLI-005', 'Repuestos del Norte',          'mayorista',  '04-4555666', '77055666', 'Oruro',  '2005555555', 12.00, v_usr);

  SELECT id INTO cl1 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-001';
  SELECT id INTO cl2 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-002';
  SELECT id INTO cl3 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-003';
  SELECT id INTO cl4 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-004';
  SELECT id INTO cl5 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-005';

  RAISE NOTICE '  ✓ 5 clientes';


  -- ── 4. PRODUCTOS (10) ──────────────────────────────────────────────────────
  INSERT INTO public.productos
    (empresa_id, sku, nombre, descripcion, categoria_id, unidad_id, precio_compra, precio_venta,
     precio_mecanico, precio_mayor, marca, aplicacion, medidas, modelos,
     anio_desde, anio_hasta, stock_minimo, ubicacion, controla_stock, activo, proveedor_id, created_by)
  VALUES
    -- Filtros
    (v_emp,'FLT-ACE-001','Filtro de Aceite Toyota 3VZ',
     'Filtro de aceite para motor 3VZ-FE 2.4L. Alta eficiencia.',
     c_filtros, v_uun, 28.00, 45.00, 38.00, 35.00,
     'Toyota Genuine','Motor 3VZ-FE 2.4L','Ø65mm H:75mm','Hilux, 4Runner, Land Cruiser',
     2000,2020,5,'A-01-F',true,true,p1,v_usr),

    (v_emp,'FLT-AIR-002','Filtro de Aire Corolla',
     'Filtro de aire panel para Toyota Corolla motor 1.6L y 1.8L.',
     c_filtros, v_uun, 20.00, 35.00, 28.00, 26.00,
     'Toyota Genuine','Motor 1.6L / 1.8L','260x180x35mm','Corolla E140, E150',
     2007,2019,5,'A-01-A',true,true,p1,v_usr),

    -- Lubricantes
    (v_emp,'LUB-MOT-003','Aceite Motor 20W-50 1L Mineral',
     'Aceite de motor mineral 20W-50 para motores gasolina. Botella 1 litro.',
     c_lubricantes, v_uun, 18.00, 30.00, 25.00, 22.00,
     'Petro-Oil','Motores gasolina carburados e inyectados','1 litro','Universal',
     null,null,12,'B-01',true,true,p4,v_usr),

    (v_emp,'LUB-ATF-004','Aceite Caja ATF Dexron III 1L',
     'Aceite para caja automática Dexron III. Botella 1 litro.',
     c_lubricantes, v_uun, 22.00, 38.00, 32.00, 28.00,
     'Castrol','Caja automática Dexron III','1 litro','Corolla, Camry, RAV4',
     null,null,8,'B-02',true,true,p4,v_usr),

    -- Frenos
    (v_emp,'FRN-PAS-005','Pastillas de Freno Delanteras Corolla',
     'Juego de pastillas de freno delanteras, incluye 4 pastillas.',
     c_frenos, v_uun, 65.00, 110.00, 90.00, 82.00,
     'Akebono','Freno delantero','juego x4 pastillas','Corolla E140/E150, Yaris',
     2006,2020,3,'C-01',true,true,p3,v_usr),

    (v_emp,'FRN-DIS-006','Disco de Freno Delantero Corolla',
     'Disco de freno delantero ventilado. Par (2 discos).',
     c_frenos, v_uun, 120.00, 200.00, 165.00, 150.00,
     'Brembo','Freno delantero ventilado','Ø260mm e:20mm','Corolla E140/E150',
     2006,2020,2,'C-02',true,true,p3,v_usr),

    -- Eléctrico
    (v_emp,'ELE-BAT-007','Batería 12V 60Ah NS60',
     'Batería libre de mantenimiento 12V 60Ah. NS60/LN2.',
     c_electrico, v_uun, 180.00, 290.00, 245.00, 230.00,
     'Bosch','Sistema eléctrico 12V','NS60 / LN2','Corolla, Hilux, RAV4, Avanza',
     null,null,2,'D-01',true,true,p2,v_usr),

    (v_emp,'ELE-BUJ-008','Bujías NGK BKR6E (set x4)',
     'Set de 4 bujías NGK BKR6E de cobre para motores 1.6-2.0L.',
     c_electrico, v_uun, 32.00, 55.00, 46.00, 42.00,
     'NGK','Motor 1.6L / 1.8L / 2.0L','BKR6E','Corolla, Yaris, RAV4, Civic',
     2000,2022,4,'D-02',true,true,p2,v_usr),

    -- Motor
    (v_emp,'MOT-COR-009','Correa Distribución Toyota 1JZ',
     'Correa de distribución para motor Toyota 1JZ-GE / 1JZ-GTE.',
     c_motor, v_uun, 55.00, 95.00, 78.00, 72.00,
     'Gates','Motor 1JZ-GE / 1JZ-GTE','L=1295mm A=25.4mm','Chaser, Mark II, Supra',
     1992,2007,2,'E-01',true,true,p5,v_usr),

    -- Suspensión
    (v_emp,'SUS-AMO-010','Amortiguador Delantero KYB Corolla',
     'Amortiguador delantero gas-aceite KYB Excel-G.',
     c_suspension, v_uun, 145.00, 240.00, 195.00, 185.00,
     'KYB','Suspensión delantera','Excel-G 333328','Corolla E120/E130',
     2000,2008,2,'F-01',true,true,p3,v_usr);

  SELECT id INTO pr1  FROM public.productos WHERE empresa_id = v_emp AND sku = 'FLT-ACE-001';
  SELECT id INTO pr2  FROM public.productos WHERE empresa_id = v_emp AND sku = 'FLT-AIR-002';
  SELECT id INTO pr3  FROM public.productos WHERE empresa_id = v_emp AND sku = 'LUB-MOT-003';
  SELECT id INTO pr4  FROM public.productos WHERE empresa_id = v_emp AND sku = 'LUB-ATF-004';
  SELECT id INTO pr5  FROM public.productos WHERE empresa_id = v_emp AND sku = 'FRN-PAS-005';
  SELECT id INTO pr6  FROM public.productos WHERE empresa_id = v_emp AND sku = 'FRN-DIS-006';
  SELECT id INTO pr7  FROM public.productos WHERE empresa_id = v_emp AND sku = 'ELE-BAT-007';
  SELECT id INTO pr8  FROM public.productos WHERE empresa_id = v_emp AND sku = 'ELE-BUJ-008';
  SELECT id INTO pr9  FROM public.productos WHERE empresa_id = v_emp AND sku = 'MOT-COR-009';
  SELECT id INTO pr10 FROM public.productos WHERE empresa_id = v_emp AND sku = 'SUS-AMO-010';

  RAISE NOTICE '  ✓ 10 productos';


  -- ── 5. STOCK INICIAL ───────────────────────────────────────────────────────
  -- movimientos de entrada (compra inicial)
  INSERT INTO public.movimientos_stock
    (empresa_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, motivo, user_id)
  VALUES
    (v_emp, pr1,  v_alm,'entrada',20,28.00,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp, pr2,  v_alm,'entrada',18,20.00,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp, pr3,  v_alm,'entrada',36,18.00,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp, pr4,  v_alm,'entrada',24,22.00,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp, pr5,  v_alm,'entrada',12,65.00,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp, pr6,  v_alm,'entrada', 8,120.00,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp, pr7,  v_alm,'entrada', 6,180.00,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp, pr8,  v_alm,'entrada',15,32.00,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp, pr9,  v_alm,'entrada', 5,55.00,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp, pr10, v_alm,'entrada', 4,145.00,'ajuste_manual','Stock inicial demo',v_usr);

  -- snapshot stock_actual
  INSERT INTO public.stock_actual (empresa_id, producto_id, almacen_id, cantidad, costo_promedio)
  VALUES
    (v_emp, pr1,  v_alm, 20, 28.00),
    (v_emp, pr2,  v_alm, 18, 20.00),
    (v_emp, pr3,  v_alm, 36, 18.00),
    (v_emp, pr4,  v_alm, 24, 22.00),
    (v_emp, pr5,  v_alm, 12, 65.00),
    (v_emp, pr6,  v_alm,  8,120.00),
    (v_emp, pr7,  v_alm,  6,180.00),
    (v_emp, pr8,  v_alm, 15, 32.00),
    (v_emp, pr9,  v_alm,  5, 55.00),
    (v_emp, pr10, v_alm,  4,145.00)
  ON CONFLICT (empresa_id, producto_id, almacen_id) DO UPDATE
    SET cantidad = EXCLUDED.cantidad, costo_promedio = EXCLUDED.costo_promedio;

  RAISE NOTICE '  ✓ Stock inicial cargado';


  -- ── 6. CAJA — sesión abierta ───────────────────────────────────────────────
  INSERT INTO public.caja_sesiones
    (empresa_id, codigo, cajero_nombre, estado, saldo_inicial, abierta_en, almacen_id)
  VALUES
    (v_emp, 'CAJA-001', 'Administrador', 'abierta', 500.00, now() - interval '3 hours', v_alm)
  RETURNING id INTO v_caja;

  -- movimiento de apertura
  INSERT INTO public.caja_movimientos
    (empresa_id, sesion_id, tipo, referencia, metodo_pago, monto, saldo_acumulado)
  VALUES
    (v_emp, v_caja, 'apertura', 'Apertura de caja', 'efectivo', 500.00, 500.00);

  RAISE NOTICE '  ✓ Caja abierta (CAJA-001, saldo inicial Bs 500)';


  -- ── 7. VENTAS (3) ──────────────────────────────────────────────────────────
  -- Venta 1: Taller San José — 2 filtros de aceite + 1 filtro de aire
  INSERT INTO public.ventas
    (empresa_id, numero, cliente_id, cliente_nombre, fecha, estado, metodo_pago,
     subtotal, total, monto_pagado, cambio, almacen_id, caja_sesion_id, created_by)
  VALUES
    (v_emp,'V-2026-0001', cl1,'Taller Mecánico San José', current_date - 2,
     'completada','efectivo', 125.00, 125.00, 130.00, 5.00, v_alm, v_caja, v_usr)
  RETURNING id INTO v1;

  INSERT INTO public.ventas_items
    (empresa_id, venta_id, producto_id, sku, nombre, cantidad, precio_unitario, subtotal, costo_unitario)
  VALUES
    (v_emp, v1, pr1,'FLT-ACE-001','Filtro de Aceite Toyota 3VZ', 2, 45.00, 90.00, 28.00),
    (v_emp, v1, pr2,'FLT-AIR-002','Filtro de Aire Corolla',       1, 35.00, 35.00, 20.00);

  -- descuento stock para V1
  UPDATE public.stock_actual SET cantidad = cantidad - 2 WHERE empresa_id = v_emp AND producto_id = pr1 AND almacen_id = v_alm;
  UPDATE public.stock_actual SET cantidad = cantidad - 1 WHERE empresa_id = v_emp AND producto_id = pr2 AND almacen_id = v_alm;
  INSERT INTO public.movimientos_stock (empresa_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, motivo, user_id)
  VALUES
    (v_emp,pr1,v_alm,'salida',2,28.00,'venta',v1,'V-2026-0001',v_usr),
    (v_emp,pr2,v_alm,'salida',1,20.00,'venta',v1,'V-2026-0001',v_usr);

  -- movimiento de caja
  INSERT INTO public.caja_movimientos
    (empresa_id, sesion_id, tipo, referencia, referencia_id, metodo_pago, monto, saldo_acumulado)
  VALUES
    (v_emp, v_caja,'venta','V-2026-0001',v1,'efectivo',125.00,625.00);


  -- Venta 2: Carlos Rodríguez — pastillas + aceite motor
  INSERT INTO public.ventas
    (empresa_id, numero, cliente_id, cliente_nombre, fecha, estado, metodo_pago,
     subtotal, total, monto_pagado, cambio, almacen_id, caja_sesion_id, created_by)
  VALUES
    (v_emp,'V-2026-0002', cl3,'Carlos Rodríguez', current_date - 1,
     'completada','tarjeta_debito', 140.00, 140.00, 140.00, 0.00, v_alm, v_caja, v_usr)
  RETURNING id INTO v2;

  INSERT INTO public.ventas_items
    (empresa_id, venta_id, producto_id, sku, nombre, cantidad, precio_unitario, subtotal, costo_unitario)
  VALUES
    (v_emp, v2, pr5,'FRN-PAS-005','Pastillas de Freno Delanteras Corolla', 1,110.00,110.00,65.00),
    (v_emp, v2, pr3,'LUB-MOT-003','Aceite Motor 20W-50 1L Mineral',        1, 30.00, 30.00,18.00);

  UPDATE public.stock_actual SET cantidad = cantidad - 1 WHERE empresa_id = v_emp AND producto_id = pr5 AND almacen_id = v_alm;
  UPDATE public.stock_actual SET cantidad = cantidad - 1 WHERE empresa_id = v_emp AND producto_id = pr3 AND almacen_id = v_alm;
  INSERT INTO public.movimientos_stock (empresa_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, motivo, user_id)
  VALUES
    (v_emp,pr5,v_alm,'salida',1, 65.00,'venta',v2,'V-2026-0002',v_usr),
    (v_emp,pr3,v_alm,'salida',1, 18.00,'venta',v2,'V-2026-0002',v_usr);

  INSERT INTO public.caja_movimientos
    (empresa_id, sesion_id, tipo, referencia, referencia_id, metodo_pago, monto, saldo_acumulado)
  VALUES
    (v_emp, v_caja,'venta','V-2026-0002',v2,'tarjeta_debito',140.00,765.00);


  -- Venta 3: Distribuidora Automotriz — batería + bujías (mayorista)
  INSERT INTO public.ventas
    (empresa_id, numero, cliente_id, cliente_nombre, fecha, estado, metodo_pago,
     subtotal, descuento_pct, descuento_monto, total, monto_pagado, cambio,
     almacen_id, caja_sesion_id, created_by)
  VALUES
    (v_emp,'V-2026-0003', cl2,'Distribuidora Automotriz Tarija', current_date,
     'completada','transferencia', 690.00, 10.00, 69.00, 621.00, 621.00, 0.00,
     v_alm, v_caja, v_usr)
  RETURNING id INTO v3;

  INSERT INTO public.ventas_items
    (empresa_id, venta_id, producto_id, sku, nombre, cantidad, precio_unitario, subtotal, costo_unitario)
  VALUES
    (v_emp, v3, pr7,'ELE-BAT-007','Batería 12V 60Ah NS60',       2,290.00,580.00,180.00),
    (v_emp, v3, pr8,'ELE-BUJ-008','Bujías NGK BKR6E (set x4)',   2, 55.00,110.00, 32.00);

  UPDATE public.stock_actual SET cantidad = cantidad - 2 WHERE empresa_id = v_emp AND producto_id = pr7 AND almacen_id = v_alm;
  UPDATE public.stock_actual SET cantidad = cantidad - 2 WHERE empresa_id = v_emp AND producto_id = pr8 AND almacen_id = v_alm;
  INSERT INTO public.movimientos_stock (empresa_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, motivo, user_id)
  VALUES
    (v_emp,pr7,v_alm,'salida',2,180.00,'venta',v3,'V-2026-0003',v_usr),
    (v_emp,pr8,v_alm,'salida',2, 32.00,'venta',v3,'V-2026-0003',v_usr);

  INSERT INTO public.caja_movimientos
    (empresa_id, sesion_id, tipo, referencia, referencia_id, metodo_pago, monto, saldo_acumulado)
  VALUES
    (v_emp, v_caja,'venta','V-2026-0003',v3,'transferencia',621.00,1386.00);

  RAISE NOTICE '  ✓ 3 ventas completadas (V-2026-0001 / 0002 / 0003)';


  -- ── 8. COTIZACIONES (2) ────────────────────────────────────────────────────
  INSERT INTO public.cotizaciones
    (empresa_id, numero, cliente_id, cliente_nombre, fecha, vigencia_dias, estado,
     subtotal, total, notas, created_by)
  VALUES
    (v_emp,'COT-2026-0001', cl4,'Taller Castro Hermanos', current_date, 15, 'pendiente',
     430.00, 430.00, 'Reparación frenos y suspensión Corolla 2008', v_usr)
  RETURNING id INTO cot1;

  INSERT INTO public.cotizaciones_items
    (empresa_id, cotizacion_id, producto_id, sku, nombre, cantidad, precio_unitario, subtotal)
  VALUES
    (v_emp, cot1, pr5,'FRN-PAS-005','Pastillas de Freno Delanteras Corolla',1,110.00,110.00),
    (v_emp, cot1, pr6,'FRN-DIS-006','Disco de Freno Delantero Corolla',     1,200.00,200.00),
    (v_emp, cot1, pr10,'SUS-AMO-010','Amortiguador Delantero KYB Corolla',  1,240.00,240.00);


  INSERT INTO public.cotizaciones
    (empresa_id, numero, cliente_id, cliente_nombre, fecha, vigencia_dias, estado,
     subtotal, total, notas, created_by)
  VALUES
    (v_emp,'COT-2026-0002', cl5,'Repuestos del Norte', current_date - 3, 30, 'pendiente',
     575.00, 575.00, 'Pedido mayorista — aceites + filtros', v_usr)
  RETURNING id INTO cot2;

  INSERT INTO public.cotizaciones_items
    (empresa_id, cotizacion_id, producto_id, sku, nombre, cantidad, precio_unitario, subtotal)
  VALUES
    (v_emp, cot2, pr3,'LUB-MOT-003','Aceite Motor 20W-50 1L Mineral',  10, 22.00, 220.00),
    (v_emp, cot2, pr4,'LUB-ATF-004','Aceite Caja ATF Dexron III 1L',    5, 28.00, 140.00),
    (v_emp, cot2, pr1,'FLT-ACE-001','Filtro de Aceite Toyota 3VZ',       5, 35.00, 175.00),
    (v_emp, cot2, pr8,'ELE-BUJ-008','Bujías NGK BKR6E (set x4)',         3, 42.00,  63.00);

  RAISE NOTICE '  ✓ 2 cotizaciones pendientes (COT-2026-0001 / 0002)';


  RAISE NOTICE '✅ Seed demo completado exitosamente.';

END;
$$;
