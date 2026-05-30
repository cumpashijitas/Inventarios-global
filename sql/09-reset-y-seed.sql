-- =============================================================================
-- 09-reset-y-seed.sql — LIMPIA TODO + recarga datos demo en un solo paso
-- =============================================================================
-- Ejecutar en Supabase SQL Editor (rol postgres / superuser)
-- CONSERVA: empresa, usuario admin, suscripción, almacenes, unidades, planes.
-- =============================================================================

-- ── 1. LIMPIAR DATOS OPERATIVOS ──────────────────────────────────────────────
set session_replication_role = replica;   -- desactiva FK checks temporalmente

truncate table public.auditoria            restart identity cascade;
truncate table public.lotes_items          restart identity cascade;
truncate table public.lotes_compra         restart identity cascade;
truncate table public.caja_movimientos     restart identity cascade;
truncate table public.caja_sesiones        restart identity cascade;
truncate table public.cotizaciones_items   restart identity cascade;
truncate table public.cotizaciones         restart identity cascade;
truncate table public.ventas_items         restart identity cascade;
truncate table public.ventas               restart identity cascade;
truncate table public.movimientos_stock    restart identity cascade;
truncate table public.stock_actual         restart identity cascade;
truncate table public.productos            restart identity cascade;
truncate table public.proveedores          restart identity cascade;
truncate table public.clientes             restart identity cascade;
truncate table public.categorias           restart identity cascade;

set session_replication_role = default;   -- restaura FK checks

-- ── 2. SEED DE DEMOSTRACIÓN ───────────────────────────────────────────────────
DO $$
DECLARE
  v_emp  uuid;
  v_usr  uuid;
  v_alm  uuid;
  v_uun  uuid;

  c_filtros   uuid; c_lubricantes uuid; c_frenos     uuid; c_motor      uuid;
  c_transm    uuid; c_electrico   uuid; c_suspension uuid; c_carroceria uuid;

  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;
  cl1 uuid; cl2 uuid; cl3 uuid; cl4 uuid; cl5 uuid;
  pr1 uuid; pr2 uuid; pr3 uuid; pr4 uuid; pr5 uuid;
  pr6 uuid; pr7 uuid; pr8 uuid; pr9 uuid; pr10 uuid;
  v_caja uuid;
  v1 uuid; v2 uuid; v3 uuid;
  cot1 uuid; cot2 uuid;

BEGIN
  -- Contexto: usa la empresa más reciente (la del usuario activo)
  SELECT id    INTO v_emp FROM public.empresas        ORDER BY created_at DESC LIMIT 1;
  SELECT id    INTO v_alm FROM public.almacenes       WHERE empresa_id = v_emp AND activo = true  LIMIT 1;
  SELECT id    INTO v_uun FROM public.unidades_medida WHERE empresa_id = v_emp AND codigo = 'UN' LIMIT 1;
  SELECT user_id INTO v_usr FROM public.usuarios_empresa WHERE empresa_id = v_emp LIMIT 1;

  IF v_emp IS NULL THEN RAISE EXCEPTION 'No hay empresa. Ejecuta 99-bootstrap primero.'; END IF;
  IF v_alm IS NULL THEN RAISE EXCEPTION 'No hay almacén activo (necesitas almacén CENTRAL).'; END IF;
  IF v_uun IS NULL THEN RAISE EXCEPTION 'No hay unidad UN (necesitas unidades de medida).'; END IF;

  RAISE NOTICE '──────────────────────────────────────────────────';
  RAISE NOTICE 'empresa_id  : %', v_emp;
  RAISE NOTICE 'almacen_id  : %', v_alm;
  RAISE NOTICE 'usuario_id  : %', v_usr;
  RAISE NOTICE '──────────────────────────────────────────────────';

  -- ── CATEGORÍAS ─────────────────────────────────────────────────────────────
  INSERT INTO public.categorias (empresa_id, nombre, orden, activo) VALUES (v_emp, 'Filtros',     1, true) RETURNING id INTO c_filtros;
  INSERT INTO public.categorias (empresa_id, nombre, orden, activo) VALUES (v_emp, 'Lubricantes', 2, true) RETURNING id INTO c_lubricantes;
  INSERT INTO public.categorias (empresa_id, nombre, orden, activo) VALUES (v_emp, 'Frenos',      3, true) RETURNING id INTO c_frenos;
  INSERT INTO public.categorias (empresa_id, nombre, orden, activo) VALUES (v_emp, 'Motor',       4, true) RETURNING id INTO c_motor;
  INSERT INTO public.categorias (empresa_id, nombre, orden, activo) VALUES (v_emp, 'Transmisión', 5, true) RETURNING id INTO c_transm;
  INSERT INTO public.categorias (empresa_id, nombre, orden, activo) VALUES (v_emp, 'Eléctrico',   6, true) RETURNING id INTO c_electrico;
  INSERT INTO public.categorias (empresa_id, nombre, orden, activo) VALUES (v_emp, 'Suspensión',  7, true) RETURNING id INTO c_suspension;
  INSERT INTO public.categorias (empresa_id, nombre, orden, activo) VALUES (v_emp, 'Carrocería',  8, true) RETURNING id INTO c_carroceria;
  RAISE NOTICE '  ✓ 8 categorías';

  -- ── PROVEEDORES ────────────────────────────────────────────────────────────
  INSERT INTO public.proveedores (empresa_id, codigo, razon_social, nombre_contacto, email, telefono, ciudad, nit, categoria, created_by) VALUES
    (v_emp,'PRV-001','Toyota Distribuidor Bolivia S.A.','Roberto Vásquez','ventas@toyotabol.com.bo','04-4123456','Tarija','1001234567','repuestos',v_usr),
    (v_emp,'PRV-002','Importadora Nissan SRL',          'Carmen Flores',  'importadora@nissan-srl.bo','04-4234567','La Paz','1002345678','repuestos',v_usr),
    (v_emp,'PRV-003','Repuestos Premium Ltda',           'Luis Méndez',   'info@repuestospremium.bo', '04-4345678','Santa Cruz','1003456789','general',v_usr),
    (v_emp,'PRV-004','Lubricantes del Sur S.A.',         'Ana Torres',    'ventas@lubsur.com.bo',     '04-4456789','Tarija','1004567890','lubricantes',v_usr),
    (v_emp,'PRV-005','Autopartes China S.R.L.',          'Jorge Quispe',  'jorge@autoparteschina.bo', '04-4567890','Oruro', '1005678901','repuestos',v_usr);

  SELECT id INTO p1 FROM public.proveedores WHERE empresa_id = v_emp AND codigo = 'PRV-001';
  SELECT id INTO p2 FROM public.proveedores WHERE empresa_id = v_emp AND codigo = 'PRV-002';
  SELECT id INTO p3 FROM public.proveedores WHERE empresa_id = v_emp AND codigo = 'PRV-003';
  SELECT id INTO p4 FROM public.proveedores WHERE empresa_id = v_emp AND codigo = 'PRV-004';
  SELECT id INTO p5 FROM public.proveedores WHERE empresa_id = v_emp AND codigo = 'PRV-005';
  RAISE NOTICE '  ✓ 5 proveedores';

  -- ── CLIENTES ───────────────────────────────────────────────────────────────
  INSERT INTO public.clientes (empresa_id, codigo, nombre, tipo, telefono, ciudad, nit, descuento_pct, created_by) VALUES
    (v_emp,'CLI-001','Taller Mecánico San José',      'mecanico', '04-4111222','Tarija','2001111111', 5.00,v_usr),
    (v_emp,'CLI-002','Distribuidora Automotriz Tarija','mayorista','04-4222333','Tarija','2002222222',10.00,v_usr),
    (v_emp,'CLI-003','Carlos Rodríguez',              'particular',null,       'Tarija', null,         0.00,v_usr),
    (v_emp,'CLI-004','Taller Castro Hermanos',        'mecanico', '04-4444555','Tarija','2004444444', 7.50,v_usr),
    (v_emp,'CLI-005','Repuestos del Norte',           'mayorista','04-4555666','Oruro', '2005555555',12.00,v_usr);

  SELECT id INTO cl1 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-001';
  SELECT id INTO cl2 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-002';
  SELECT id INTO cl3 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-003';
  SELECT id INTO cl4 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-004';
  SELECT id INTO cl5 FROM public.clientes WHERE empresa_id = v_emp AND codigo = 'CLI-005';
  RAISE NOTICE '  ✓ 5 clientes';

  -- ── PRODUCTOS ──────────────────────────────────────────────────────────────
  INSERT INTO public.productos
    (empresa_id, sku, nombre, descripcion, categoria_id, unidad_id,
     precio_compra, precio_venta, precio_mecanico, precio_mayor,
     marca, aplicacion, medidas, modelos, anio_desde, anio_hasta,
     stock_minimo, ubicacion, controla_stock, activo, proveedor_id, created_by)
  VALUES
    (v_emp,'FLT-ACE-001','Filtro de Aceite Toyota 3VZ',      'Filtro aceite motor 3VZ-FE 2.4L.',           c_filtros,    v_uun,28,45,38,35,'Toyota Genuine','Motor 3VZ-FE 2.4L',  'Ø65mm H:75mm',     'Hilux,4Runner,Land Cruiser', 2000,2020,5,'A-01',true,true,p1,v_usr),
    (v_emp,'FLT-AIR-002','Filtro de Aire Corolla',            'Filtro aire panel 1.6L y 1.8L.',             c_filtros,    v_uun,20,35,28,26,'Toyota Genuine','Motor 1.6L/1.8L',    '260x180x35mm',     'Corolla E140/E150',          2007,2019,5,'A-02',true,true,p1,v_usr),
    (v_emp,'LUB-MOT-003','Aceite Motor 20W-50 1L Mineral',   'Aceite motor mineral 20W-50. 1 litro.',      c_lubricantes,v_uun,18,30,25,22,'Petro-Oil',     'Motores gasolina',    '1 litro',          'Universal',                  null,null,12,'B-01',true,true,p4,v_usr),
    (v_emp,'LUB-ATF-004','Aceite Caja ATF Dexron III 1L',    'Aceite caja automática Dexron III. 1L.',     c_lubricantes,v_uun,22,38,32,28,'Castrol',       'Caja automática',     '1 litro',          'Corolla,Camry,RAV4',         null,null, 8,'B-02',true,true,p4,v_usr),
    (v_emp,'FRN-PAS-005','Pastillas de Freno Delant. Corolla','Set 4 pastillas freno delantero.',          c_frenos,     v_uun,65,110,90,82,'Akebono',       'Freno delantero',     'juego x4',         'Corolla E140/E150,Yaris',    2006,2020,3,'C-01',true,true,p3,v_usr),
    (v_emp,'FRN-DIS-006','Disco de Freno Delantero Corolla', 'Par discos freno delantero ventilado.',      c_frenos,     v_uun,120,200,165,150,'Brembo',     'Freno delant. vent.', 'Ø260mm e:20mm',    'Corolla E140/E150',          2006,2020,2,'C-02',true,true,p3,v_usr),
    (v_emp,'ELE-BAT-007','Batería 12V 60Ah NS60',            'Batería libre mantenimiento 12V 60Ah.',      c_electrico,  v_uun,180,290,245,230,'Bosch',      'Sistema eléctrico',   'NS60/LN2',         'Corolla,Hilux,RAV4,Avanza',  null,null, 2,'D-01',true,true,p2,v_usr),
    (v_emp,'ELE-BUJ-008','Bujías NGK BKR6E (set x4)',        'Set 4 bujías NGK cobre 1.6-2.0L.',          c_electrico,  v_uun,32,55,46,42,'NGK',           'Motor 1.6/1.8/2.0L',  'BKR6E',            'Corolla,Yaris,RAV4,Civic',   2000,2022,4,'D-02',true,true,p2,v_usr),
    (v_emp,'MOT-COR-009','Correa Distribución Toyota 1JZ',   'Correa dist. motor 1JZ-GE/1JZ-GTE.',        c_motor,      v_uun,55,95,78,72,'Gates',         'Motor 1JZ-GE/GTE',    'L=1295mm A=25.4mm','Chaser,Mark II,Supra',       1992,2007,2,'E-01',true,true,p5,v_usr),
    (v_emp,'SUS-AMO-010','Amortiguador Delant. KYB Corolla', 'Amortiguador delanero gas-aceite Excel-G.', c_suspension, v_uun,145,240,195,185,'KYB',        'Suspensión delantera','Excel-G 333328',   'Corolla E120/E130',          2000,2008,2,'F-01',true,true,p3,v_usr);

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

  -- ── STOCK INICIAL ──────────────────────────────────────────────────────────
  INSERT INTO public.movimientos_stock
    (empresa_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, motivo, user_id)
  VALUES
    (v_emp,pr1, v_alm,'entrada',20, 28,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp,pr2, v_alm,'entrada',18, 20,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp,pr3, v_alm,'entrada',36, 18,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp,pr4, v_alm,'entrada',24, 22,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp,pr5, v_alm,'entrada',12, 65,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp,pr6, v_alm,'entrada', 8,120,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp,pr7, v_alm,'entrada', 6,180,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp,pr8, v_alm,'entrada',15, 32,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp,pr9, v_alm,'entrada', 5, 55,'ajuste_manual','Stock inicial demo',v_usr),
    (v_emp,pr10,v_alm,'entrada', 4,145,'ajuste_manual','Stock inicial demo',v_usr);

  INSERT INTO public.stock_actual (empresa_id, producto_id, almacen_id, cantidad, costo_promedio)
  VALUES
    (v_emp,pr1, v_alm,20, 28),(v_emp,pr2, v_alm,18, 20),(v_emp,pr3, v_alm,36, 18),
    (v_emp,pr4, v_alm,24, 22),(v_emp,pr5, v_alm,12, 65),(v_emp,pr6, v_alm, 8,120),
    (v_emp,pr7, v_alm, 6,180),(v_emp,pr8, v_alm,15, 32),(v_emp,pr9, v_alm, 5, 55),
    (v_emp,pr10,v_alm, 4,145)
  ON CONFLICT (empresa_id, producto_id, almacen_id)
    DO UPDATE SET cantidad = EXCLUDED.cantidad, costo_promedio = EXCLUDED.costo_promedio;
  RAISE NOTICE '  ✓ Stock inicial';

  -- ── CAJA ───────────────────────────────────────────────────────────────────
  INSERT INTO public.caja_sesiones
    (empresa_id, codigo, cajero_nombre, estado, saldo_inicial, abierta_en, almacen_id)
  VALUES (v_emp,'CAJA-001','Administrador','abierta',500, now()-interval '3 hours', v_alm)
  RETURNING id INTO v_caja;

  INSERT INTO public.caja_movimientos
    (empresa_id, sesion_id, tipo, referencia, metodo_pago, monto, saldo_acumulado)
  VALUES (v_emp, v_caja,'apertura','Apertura de caja','efectivo',500,500);
  RAISE NOTICE '  ✓ Caja abierta (Bs 500)';

  -- ── VENTA 1 ────────────────────────────────────────────────────────────────
  INSERT INTO public.ventas
    (empresa_id, numero, cliente_id, cliente_nombre, fecha, estado, metodo_pago,
     subtotal, total, monto_pagado, cambio, almacen_id, caja_sesion_id, created_by)
  VALUES (v_emp,'V-2026-0001',cl1,'Taller Mecánico San José',current_date-2,
          'completada','efectivo',125,125,130,5,v_alm,v_caja,v_usr)
  RETURNING id INTO v1;

  INSERT INTO public.ventas_items
    (empresa_id,venta_id,producto_id,sku,nombre,cantidad,precio_unitario,subtotal,costo_unitario)
  VALUES
    (v_emp,v1,pr1,'FLT-ACE-001','Filtro de Aceite Toyota 3VZ',2,45,90,28),
    (v_emp,v1,pr2,'FLT-AIR-002','Filtro de Aire Corolla',      1,35,35,20);

  UPDATE public.stock_actual SET cantidad = cantidad - 2 WHERE empresa_id=v_emp AND producto_id=pr1 AND almacen_id=v_alm;
  UPDATE public.stock_actual SET cantidad = cantidad - 1 WHERE empresa_id=v_emp AND producto_id=pr2 AND almacen_id=v_alm;
  INSERT INTO public.movimientos_stock (empresa_id,producto_id,almacen_id,tipo,cantidad,costo_unitario,referencia_tipo,referencia_id,motivo,user_id)
  VALUES (v_emp,pr1,v_alm,'salida',2,28,'venta',v1,'V-2026-0001',v_usr),
         (v_emp,pr2,v_alm,'salida',1,20,'venta',v1,'V-2026-0001',v_usr);
  INSERT INTO public.caja_movimientos (empresa_id,sesion_id,tipo,referencia,referencia_id,metodo_pago,monto,saldo_acumulado)
  VALUES (v_emp,v_caja,'venta','V-2026-0001',v1,'efectivo',125,625);

  -- ── VENTA 2 ────────────────────────────────────────────────────────────────
  INSERT INTO public.ventas
    (empresa_id,numero,cliente_id,cliente_nombre,fecha,estado,metodo_pago,
     subtotal,total,monto_pagado,cambio,almacen_id,caja_sesion_id,created_by)
  VALUES (v_emp,'V-2026-0002',cl3,'Carlos Rodríguez',current_date-1,
          'completada','tarjeta_debito',140,140,140,0,v_alm,v_caja,v_usr)
  RETURNING id INTO v2;

  INSERT INTO public.ventas_items
    (empresa_id,venta_id,producto_id,sku,nombre,cantidad,precio_unitario,subtotal,costo_unitario)
  VALUES
    (v_emp,v2,pr5,'FRN-PAS-005','Pastillas de Freno Delant. Corolla',1,110,110,65),
    (v_emp,v2,pr3,'LUB-MOT-003','Aceite Motor 20W-50 1L Mineral',    1, 30, 30,18);

  UPDATE public.stock_actual SET cantidad = cantidad - 1 WHERE empresa_id=v_emp AND producto_id=pr5 AND almacen_id=v_alm;
  UPDATE public.stock_actual SET cantidad = cantidad - 1 WHERE empresa_id=v_emp AND producto_id=pr3 AND almacen_id=v_alm;
  INSERT INTO public.movimientos_stock (empresa_id,producto_id,almacen_id,tipo,cantidad,costo_unitario,referencia_tipo,referencia_id,motivo,user_id)
  VALUES (v_emp,pr5,v_alm,'salida',1, 65,'venta',v2,'V-2026-0002',v_usr),
         (v_emp,pr3,v_alm,'salida',1, 18,'venta',v2,'V-2026-0002',v_usr);
  INSERT INTO public.caja_movimientos (empresa_id,sesion_id,tipo,referencia,referencia_id,metodo_pago,monto,saldo_acumulado)
  VALUES (v_emp,v_caja,'venta','V-2026-0002',v2,'tarjeta_debito',140,765);

  -- ── VENTA 3 ────────────────────────────────────────────────────────────────
  INSERT INTO public.ventas
    (empresa_id,numero,cliente_id,cliente_nombre,fecha,estado,metodo_pago,
     subtotal,descuento_pct,descuento_monto,total,monto_pagado,cambio,
     almacen_id,caja_sesion_id,created_by)
  VALUES (v_emp,'V-2026-0003',cl2,'Distribuidora Automotriz Tarija',current_date,
          'completada','transferencia',690,10,69,621,621,0,v_alm,v_caja,v_usr)
  RETURNING id INTO v3;

  INSERT INTO public.ventas_items
    (empresa_id,venta_id,producto_id,sku,nombre,cantidad,precio_unitario,subtotal,costo_unitario)
  VALUES
    (v_emp,v3,pr7,'ELE-BAT-007','Batería 12V 60Ah NS60',      2,290,580,180),
    (v_emp,v3,pr8,'ELE-BUJ-008','Bujías NGK BKR6E (set x4)',  2, 55,110, 32);

  UPDATE public.stock_actual SET cantidad = cantidad - 2 WHERE empresa_id=v_emp AND producto_id=pr7 AND almacen_id=v_alm;
  UPDATE public.stock_actual SET cantidad = cantidad - 2 WHERE empresa_id=v_emp AND producto_id=pr8 AND almacen_id=v_alm;
  INSERT INTO public.movimientos_stock (empresa_id,producto_id,almacen_id,tipo,cantidad,costo_unitario,referencia_tipo,referencia_id,motivo,user_id)
  VALUES (v_emp,pr7,v_alm,'salida',2,180,'venta',v3,'V-2026-0003',v_usr),
         (v_emp,pr8,v_alm,'salida',2, 32,'venta',v3,'V-2026-0003',v_usr);
  INSERT INTO public.caja_movimientos (empresa_id,sesion_id,tipo,referencia,referencia_id,metodo_pago,monto,saldo_acumulado)
  VALUES (v_emp,v_caja,'venta','V-2026-0003',v3,'transferencia',621,1386);

  RAISE NOTICE '  ✓ 3 ventas';

  -- ── COTIZACIONES ───────────────────────────────────────────────────────────
  INSERT INTO public.cotizaciones
    (empresa_id,numero,cliente_id,cliente_nombre,fecha,vigencia_dias,estado,subtotal,total,notas,created_by)
  VALUES (v_emp,'COT-2026-0001',cl4,'Taller Castro Hermanos',current_date,15,'pendiente',
          430,430,'Reparación frenos y suspensión Corolla 2008',v_usr)
  RETURNING id INTO cot1;

  INSERT INTO public.cotizaciones_items
    (empresa_id,cotizacion_id,producto_id,sku,nombre,cantidad,precio_unitario,subtotal)
  VALUES
    (v_emp,cot1,pr5,'FRN-PAS-005','Pastillas de Freno Delant. Corolla',1,110,110),
    (v_emp,cot1,pr6,'FRN-DIS-006','Disco de Freno Delantero Corolla',  1,200,200),
    (v_emp,cot1,pr10,'SUS-AMO-010','Amortiguador Delant. KYB Corolla', 1,240,240);

  INSERT INTO public.cotizaciones
    (empresa_id,numero,cliente_id,cliente_nombre,fecha,vigencia_dias,estado,subtotal,total,notas,created_by)
  VALUES (v_emp,'COT-2026-0002',cl5,'Repuestos del Norte',current_date-3,30,'pendiente',
          575,575,'Pedido mayorista — aceites + filtros',v_usr)
  RETURNING id INTO cot2;

  INSERT INTO public.cotizaciones_items
    (empresa_id,cotizacion_id,producto_id,sku,nombre,cantidad,precio_unitario,subtotal)
  VALUES
    (v_emp,cot2,pr3,'LUB-MOT-003','Aceite Motor 20W-50 1L Mineral', 10,22,220),
    (v_emp,cot2,pr4,'LUB-ATF-004','Aceite Caja ATF Dexron III 1L',   5,28,140),
    (v_emp,cot2,pr1,'FLT-ACE-001','Filtro de Aceite Toyota 3VZ',      5,35,175),
    (v_emp,cot2,pr8,'ELE-BUJ-008','Bujías NGK BKR6E (set x4)',        3,42, 63);

  RAISE NOTICE '  ✓ 2 cotizaciones';

  -- ── VERIFICACIÓN FINAL ─────────────────────────────────────────────────────
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '✅ Seed completado. Conteos finales:';
  RAISE NOTICE '   categorias  : %', (SELECT count(*) FROM public.categorias  WHERE empresa_id = v_emp);
  RAISE NOTICE '   proveedores : %', (SELECT count(*) FROM public.proveedores WHERE empresa_id = v_emp);
  RAISE NOTICE '   clientes    : %', (SELECT count(*) FROM public.clientes    WHERE empresa_id = v_emp);
  RAISE NOTICE '   productos   : %', (SELECT count(*) FROM public.productos   WHERE empresa_id = v_emp);
  RAISE NOTICE '   stock_actual: %', (SELECT count(*) FROM public.stock_actual WHERE empresa_id = v_emp);
  RAISE NOTICE '   ventas      : %', (SELECT count(*) FROM public.ventas      WHERE empresa_id = v_emp);
  RAISE NOTICE '   cotizaciones: %', (SELECT count(*) FROM public.cotizaciones WHERE empresa_id = v_emp);
  RAISE NOTICE '══════════════════════════════════════════════════';

END;
$$;

-- ── VERIFICACIÓN SQL (visible en los resultados del Editor) ──────────────────
SELECT
  (SELECT count(*) FROM public.categorias)  AS categorias,
  (SELECT count(*) FROM public.productos)   AS productos,
  (SELECT count(*) FROM public.proveedores) AS proveedores,
  (SELECT count(*) FROM public.clientes)    AS clientes,
  (SELECT count(*) FROM public.ventas)      AS ventas,
  (SELECT count(*) FROM public.stock_actual)AS stock,
  (SELECT id       FROM public.empresas LIMIT 1) AS empresa_id;
