-- =============================================================================
-- 27-restaurar-todo.sql
-- Restaura todo lo que eliminó 26-single-tenant.sql
-- Ejecutar como superuser/service-role en Supabase SQL Editor
-- =============================================================================

-- 1. Restaurar funciones de tenant context a su versión original
CREATE OR REPLACE FUNCTION public.current_empresa_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_empresa_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

-- 2. Recrear tablas SaaS eliminadas (en orden de dependencias)

CREATE TABLE IF NOT EXISTS public.planes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text NOT NULL UNIQUE,
  nombre          text NOT NULL,
  descripcion     text,
  precio_mensual  numeric(14,4) NOT NULL DEFAULT 0,
  moneda          char(3) NOT NULL DEFAULT 'BOB',
  orden           int NOT NULL DEFAULT 0,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_planes_updated_at BEFORE UPDATE ON public.planes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.modulos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text NOT NULL UNIQUE,
  nombre        text NOT NULL,
  descripcion   text,
  categoria     text NOT NULL DEFAULT 'core',
  precio_addon  numeric(14,4) DEFAULT 0,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_modulos_updated_at BEFORE UPDATE ON public.modulos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.plan_modulos (
  plan_id   uuid NOT NULL REFERENCES public.planes(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, modulo_id)
);

CREATE TABLE IF NOT EXISTS public.empresa_suscripciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plan_id             uuid NOT NULL REFERENCES public.planes(id),
  estado              text NOT NULL DEFAULT 'activa',
  inicio              date NOT NULL DEFAULT current_date,
  fin                 date,
  precio_pactado      numeric(14,4) NOT NULL,
  moneda              char(3) NOT NULL DEFAULT 'BOB',
  ciclo_facturacion   text NOT NULL DEFAULT 'mensual',
  proxima_facturacion date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_empresa_suscripcion_activa
  ON public.empresa_suscripciones (empresa_id)
  WHERE estado IN ('trial','activa','morosa');
CREATE OR REPLACE TRIGGER trg_empresa_suscripciones_updated_at BEFORE UPDATE ON public.empresa_suscripciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.empresa_modulos_extra (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modulo_id      uuid NOT NULL REFERENCES public.modulos(id),
  precio_pactado numeric(14,4) NOT NULL DEFAULT 0,
  activo         boolean NOT NULL DEFAULT true,
  inicio         date NOT NULL DEFAULT current_date,
  fin            date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, modulo_id)
);
CREATE OR REPLACE TRIGGER trg_empresa_modulos_extra_updated_at BEFORE UPDATE ON public.empresa_modulos_extra
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.roles_empresa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo      text NOT NULL,
  nombre      text NOT NULL,
  descripcion text,
  permisos    jsonb NOT NULL DEFAULT '[]'::jsonb,
  es_sistema  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE OR REPLACE TRIGGER trg_roles_empresa_updated_at BEFORE UPDATE ON public.roles_empresa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.empresa_politicas_acceso (
  empresa_id                             uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  exigir_mfa                             boolean NOT NULL DEFAULT false,
  permitir_solo_dispositivos_autorizados boolean NOT NULL DEFAULT false,
  permitir_solo_ips_listadas             boolean NOT NULL DEFAULT false,
  duracion_sesion_min                    int NOT NULL DEFAULT 480,
  reintentos_max_login                   int NOT NULL DEFAULT 5,
  bloqueo_minutos                        int NOT NULL DEFAULT 15,
  updated_at                             timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_politicas_updated_at BEFORE UPDATE ON public.empresa_politicas_acceso
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.dispositivos_autorizados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  device_hash text NOT NULL,
  nombre      text,
  ultimo_uso  timestamptz,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, user_id, device_hash)
);

CREATE TABLE IF NOT EXISTS public.empresa_ips_permitidas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cidr        cidr NOT NULL,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sesiones_usuario (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  ip           inet,
  user_agent   text,
  device_hash  text,
  iniciada_en  timestamptz NOT NULL DEFAULT now(),
  expira_en    timestamptz NOT NULL,
  revocada_en  timestamptz,
  revocada_por uuid,
  motivo_revoc text
);
CREATE INDEX IF NOT EXISTS ix_sesiones_user    ON public.sesiones_usuario(user_id);
CREATE INDEX IF NOT EXISTS ix_sesiones_empresa ON public.sesiones_usuario(empresa_id);

-- 3. Permisos al rol app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planes                   TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos                  TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_modulos             TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_suscripciones    TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_modulos_extra    TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles_empresa            TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_politicas_acceso TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispositivos_autorizados TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_ips_permitidas   TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sesiones_usuario         TO app_user;

-- 4. Seed: módulos y planes (antes del seed de roles para que FK funcione)
INSERT INTO public.modulos (codigo, nombre, descripcion, categoria, precio_addon) VALUES
  ('inventario',        'Inventario',           'Productos, almacenes, stock y movimientos.', 'core', 0),
  ('reportes_basicos',  'Reportes básicos',     'Reportes operativos de inventario.',         'core', 0),
  ('ventas',            'Ventas',               'Cotizaciones, ventas, clientes, cobros.',    'core', 0),
  ('compras',           'Compras',              'Órdenes de compra y proveedores.',           'core', 0),
  ('clientes',          'CRM Clientes',         'Ficha cliente, historial, segmentación.',    'core', 0),
  ('dashboard',         'Dashboard ejecutivo',  'KPIs en tiempo real.',                       'core', 0),
  ('multisucursal',     'Multi-sucursal',       'Gestión de varias sucursales.',              'core', 0),
  ('vendedores',        'Vendedores en campo',  'App móvil para fuerza de ventas.',           'core', 0),
  ('control_comercial', 'Control comercial',    'Comisiones, rutas, metas.',                  'core', 0),
  ('credito',           'Crédito y cobranzas',  'Líneas de crédito, mora, recordatorios.',    'core', 0),
  ('permisos_avanzados','Permisos avanzados',   'Roles y permisos por sucursal.',             'core', 0),
  ('reportes_avanzados','Reportes avanzados',   'Reportes configurables y exportables.',      'core', 0),
  ('caja',              'Gestión de Caja',      'Apertura/cierre de caja, movimientos.',      'core', 0),
  ('reportes',          'Reportes',             'Reportes de ventas, inventario.',            'core', 0),
  ('agente_ia',         'Agente IA',            'Asistente IA para decisiones operativas.',   'addon', 99),
  ('ecommerce',         'E-commerce',           'Tienda online conectada al inventario.',     'addon', 49),
  ('geolocalizacion',   'Geolocalización',      'Tracking de vendedores y rutas.',            'addon', 29),
  ('notificaciones',    'Notificaciones',       'WhatsApp, SMS, email automáticos.',          'addon', 19),
  ('analitica_avanzada','Analítica avanzada',   'BI, cohortes, predicciones.',                'addon', 49),
  ('facturacion_siat',  'Facturación SIAT',     'Facturación electrónica Bolivia.',           'addon', 39),
  ('seguridad_avanzada','Seguridad avanzada',   'Restricción por dispositivo o IP.',          'addon', 19)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion;

INSERT INTO public.planes (codigo, nombre, descripcion, precio_mensual, moneda, orden) VALUES
  ('basico',        'Básico',        'Inventario, stock y reportes básicos.',        199,  'BOB', 1),
  ('profesional',   'Profesional',   'Todo el Básico + ventas, clientes, compras.',  499,  'BOB', 2),
  ('distribuidora', 'Distribuidora', 'Profesional + vendedores y control comercial.', 899,  'BOB', 3),
  ('empresarial',   'Empresarial',   'Distribuidora + multi-sucursal y crédito.',    1499, 'BOB', 4)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre, precio_mensual = EXCLUDED.precio_mensual;

-- Plan empresarial incluye todos los módulos
INSERT INTO public.plan_modulos (plan_id, modulo_id)
SELECT p.id, m.id
FROM public.planes p, public.modulos m
WHERE p.codigo = 'empresarial'
ON CONFLICT DO NOTHING;

-- 5. Crear roles del sistema para la empresa existente
-- IMPORTANTE: hay que hacer esto ANTES de restaurar el FK
INSERT INTO public.roles_empresa (empresa_id, codigo, nombre, descripcion, permisos, es_sistema)
SELECT
  e.id,
  r.codigo,
  r.nombre,
  r.descripcion,
  r.permisos::jsonb,
  true
FROM public.empresas e,
(VALUES
  ('admin',                'Administrador',   'Control total del sistema',                '[]'::text),
  ('vendedor',             'Vendedor',        'Acceso a ventas e inventario (lectura)',   '["ventas.ver","ventas.crear","inventario.ver","reportes.ver"]'),
  ('encargado_inventario', 'Enc. Inventario', 'Gestión completa de inventario',          '["inventario.ver","inventario.editar","reportes.ver"]'),
  ('cajero',               'Cajero',          'Gestión de caja, ventas y pagos',         '["caja.ver","ventas.ver","reportes.ver"]')
) AS r(codigo, nombre, descripcion, permisos)
WHERE e.deleted_at IS NULL
ON CONFLICT (empresa_id, codigo) DO NOTHING;

-- 6. Actualizar usuarios_empresa.rol_id para apuntar al nuevo rol admin
--    (los UUIDs anteriores de roles_empresa ya no existen; actualiza TODOS,
--     incluyendo soft-deleted, para que el FK no falle en la validación)
UPDATE public.usuarios_empresa ue
SET rol_id = re.id
FROM public.roles_empresa re
WHERE re.empresa_id = ue.empresa_id
  AND re.codigo = 'admin';

-- 7. Ahora sí restaurar el FK (con datos válidos)
ALTER TABLE public.usuarios_empresa
  DROP CONSTRAINT IF EXISTS usuarios_empresa_rol_id_fkey;
ALTER TABLE public.usuarios_empresa
  ADD CONSTRAINT usuarios_empresa_rol_id_fkey
  FOREIGN KEY (rol_id) REFERENCES public.roles_empresa(id);

-- 8. Crear suscripción activa para la empresa existente (plan empresarial)
INSERT INTO public.empresa_suscripciones
  (empresa_id, plan_id, estado, precio_pactado, moneda)
SELECT
  e.id,
  p.id,
  'activa',
  0,
  'BOB'
FROM public.empresas e, public.planes p
WHERE p.codigo = 'empresarial'
  AND e.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- 9. Rehabilitar RLS en todas las tablas
ALTER TABLE public.planes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modulos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modulos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_suscripciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_modulos_extra    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles_empresa            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_empresa         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_politicas_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos_autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_ips_permitidas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_usuario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almacenes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_medida          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_actual             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_stock        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja_sesiones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja_movimientos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_compra             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoluciones             ENABLE ROW LEVEL SECURITY;

-- 10. Recrear todas las policies RLS
CREATE POLICY planes_read_all       ON public.planes       FOR SELECT TO app_user USING (true);
CREATE POLICY modulos_read_all      ON public.modulos      FOR SELECT TO app_user USING (true);
CREATE POLICY plan_modulos_read_all ON public.plan_modulos FOR SELECT TO app_user USING (true);

CREATE POLICY empresas_self ON public.empresas
  FOR ALL TO app_user
  USING (id = public.current_empresa_id())
  WITH CHECK (id = public.current_empresa_id());

CREATE POLICY empresa_suscripciones_isolated ON public.empresa_suscripciones
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY empresa_modulos_extra_isolated ON public.empresa_modulos_extra
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY roles_empresa_isolated ON public.roles_empresa
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY usuarios_empresa_isolated ON public.usuarios_empresa
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY politicas_isolated ON public.empresa_politicas_acceso
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY dispositivos_isolated ON public.dispositivos_autorizados
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY ips_isolated ON public.empresa_ips_permitidas
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY sesiones_isolated ON public.sesiones_usuario
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY auditoria_read ON public.auditoria
  FOR SELECT TO app_user
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY auditoria_insert ON public.auditoria
  FOR INSERT TO app_user
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY almacenes_isolated ON public.almacenes
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY categorias_isolated ON public.categorias
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY unidades_isolated ON public.unidades_medida
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY productos_isolated ON public.productos
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY stock_actual_isolated ON public.stock_actual
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY movimientos_stock_isolated ON public.movimientos_stock
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY proveedores_isolated ON public.proveedores
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY clientes_isolated ON public.clientes
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY ventas_isolated ON public.ventas
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY ventas_items_isolated ON public.ventas_items
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY cotizaciones_isolated ON public.cotizaciones
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY cotizaciones_items_isolated ON public.cotizaciones_items
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY caja_sesiones_isolated ON public.caja_sesiones
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY caja_movimientos_isolated ON public.caja_movimientos
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY lotes_compra_isolated ON public.lotes_compra
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY lotes_items_isolated ON public.lotes_items
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY devoluciones_isolated ON public.devoluciones
  FOR ALL TO app_user
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- 11. Restaurar empresa_tiene_modulo()
CREATE OR REPLACE FUNCTION public.empresa_tiene_modulo(p_codigo_modulo text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  WITH mod AS (SELECT id FROM public.modulos WHERE codigo = p_codigo_modulo LIMIT 1),
       sub AS (
         SELECT plan_id FROM public.empresa_suscripciones
          WHERE empresa_id = public.current_empresa_id()
            AND estado IN ('trial','activa','morosa')
          LIMIT 1
       )
  SELECT EXISTS (
    SELECT 1 FROM public.plan_modulos pm, sub, mod
     WHERE pm.plan_id = sub.plan_id AND pm.modulo_id = mod.id
  )
  OR EXISTS (
    SELECT 1 FROM public.empresa_modulos_extra eme, mod
     WHERE eme.empresa_id = public.current_empresa_id()
       AND eme.modulo_id = mod.id
       AND eme.activo = true
       AND (eme.fin IS NULL OR eme.fin >= current_date)
  );
$$;

GRANT EXECUTE ON FUNCTION public.empresa_tiene_modulo(text) TO app_user;

-- 12. Restaurar registrar_movimiento_stock() con current_empresa_id y current_user_id
CREATE OR REPLACE FUNCTION public.registrar_movimiento_stock(
  p_producto_id    uuid,
  p_almacen_id     uuid,
  p_tipo           text,
  p_cantidad       numeric,
  p_costo_unitario numeric DEFAULT 0,
  p_referencia_tipo text DEFAULT NULL,
  p_referencia_id  uuid DEFAULT NULL,
  p_motivo         text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_empresa_id    uuid := public.current_empresa_id();
  v_user_id       uuid := public.current_user_id();
  v_movimiento_id uuid;
  v_signo         int;
  v_stock_actual  numeric;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'tenant context not set';
  END IF;
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'cantidad debe ser positiva';
  END IF;

  v_signo := CASE
    WHEN p_tipo IN ('entrada','transferencia_in','ajuste') THEN 1
    WHEN p_tipo IN ('salida','transferencia_out')          THEN -1
    ELSE NULL
  END;
  IF v_signo IS NULL THEN
    RAISE EXCEPTION 'tipo de movimiento inválido: %', p_tipo;
  END IF;

  INSERT INTO public.movimientos_stock
    (empresa_id, producto_id, almacen_id, tipo, cantidad,
     costo_unitario, referencia_tipo, referencia_id, motivo, user_id)
  VALUES
    (v_empresa_id, p_producto_id, p_almacen_id, p_tipo, p_cantidad,
     p_costo_unitario, p_referencia_tipo, p_referencia_id, p_motivo, v_user_id)
  RETURNING id INTO v_movimiento_id;

  INSERT INTO public.stock_actual (empresa_id, producto_id, almacen_id, cantidad, costo_promedio)
  VALUES (v_empresa_id, p_producto_id, p_almacen_id, p_cantidad * v_signo, p_costo_unitario)
  ON CONFLICT (empresa_id, producto_id, almacen_id) DO UPDATE
    SET
      cantidad = stock_actual.cantidad + (EXCLUDED.cantidad),
      costo_promedio = CASE
        WHEN v_signo = 1 AND (stock_actual.cantidad + EXCLUDED.cantidad) > 0 THEN
          ((stock_actual.cantidad * stock_actual.costo_promedio) +
           (EXCLUDED.cantidad * EXCLUDED.costo_promedio))
          / NULLIF(stock_actual.cantidad + EXCLUDED.cantidad, 0)
        ELSE stock_actual.costo_promedio
      END,
      updated_at = now();

  SELECT cantidad INTO v_stock_actual
    FROM public.stock_actual
   WHERE empresa_id = v_empresa_id
     AND producto_id = p_producto_id
     AND almacen_id  = p_almacen_id;

  IF v_stock_actual < 0 THEN
    RAISE EXCEPTION 'stock insuficiente: producto=% almacen=% queda=%',
      p_producto_id, p_almacen_id, v_stock_actual;
  END IF;

  RETURN v_movimiento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_movimiento_stock(uuid,uuid,text,numeric,numeric,text,uuid,text) TO app_user;

-- =============================================================================
-- FIN — todo restaurado
-- =============================================================================
