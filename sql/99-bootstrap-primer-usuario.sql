-- =============================================================================
-- 99-bootstrap-primer-usuario.sql
-- Crea tu primera empresa, te asigna como admin y te da una suscripción activa.
--
-- PRERREQUISITO: ya creaste el usuario en Supabase Auth.
--   Dashboard de Supabase → Authentication → Users → "Add user" → "Create new user"
--   - Email:    el que vas a usar para loguear
--   - Password: el que vas a usar
--   - Marca "Auto Confirm User" (si no, te tocará confirmar por email)
--   - Copia el "User UID" que te muestra después de crearlo
--
-- INSTRUCCIONES DE USO:
--   1. Reemplaza los 4 placeholders al inicio (BUSCA "<<<<<").
--   2. Ejecuta este script entero en el SQL Editor de Supabase (rol postgres).
--   3. Listo: ya puedes loguear desde el frontend.
--
-- Idempotente: puedes correrlo varias veces sin romper nada.
-- =============================================================================

do $$
declare
  -- ============================ EDITA AQUÍ ===================================
  v_user_id           uuid := '<<<<< PEGA AQUÍ EL USER UID DE SUPABASE AUTH >>>>>'::uuid;
  v_email             text := '<<<<< pon-aqui-tu-email@dominio.com >>>>>';
  v_nombre            text := '<<<<< Tu Nombre >>>>>';
  v_razon_social      text := '<<<<< Mi Empresa S.R.L. >>>>>';
  v_plan_codigo       text := 'profesional';   -- 'basico'|'profesional'|'distribuidora'|'empresarial'
  -- ===========================================================================

  v_empresa_id   uuid;
  v_plan_id      uuid;
  v_rol_id       uuid;
  v_almacen_id   uuid;
  v_unidad_un_id uuid;
  v_unidad_kg_id uuid;
begin
  -- 1. Empresa (idempotente: busca por nombre exacto, crea si no existe)
  select id into v_empresa_id
    from public.empresas
   where razon_social = v_razon_social
     and deleted_at is null
   limit 1;

  if v_empresa_id is null then
    insert into public.empresas (razon_social, nombre_comercial, pais, moneda_principal)
    values (v_razon_social, v_razon_social, 'BO', 'BOB')
    returning id into v_empresa_id;
  end if;

  -- 2. Suscripción activa (al plan elegido)
  select id into v_plan_id from public.planes where codigo = v_plan_codigo;
  if v_plan_id is null then
    raise exception 'Plan % no existe. ¿Aplicaste 03-seed.sql?', v_plan_codigo;
  end if;

  insert into public.empresa_suscripciones
    (empresa_id, plan_id, estado, precio_pactado, moneda, ciclo_facturacion, proxima_facturacion)
  select v_empresa_id, v_plan_id, 'activa',
         (select precio_mensual from public.planes where id = v_plan_id),
         'BOB', 'mensual', current_date + interval '1 month'
  where not exists (
    select 1 from public.empresa_suscripciones
     where empresa_id = v_empresa_id and estado in ('trial','activa','morosa')
  );

  -- 3. Rol "admin" para la empresa (con permisos completos)
  insert into public.roles_empresa (empresa_id, codigo, nombre, descripcion, permisos, es_sistema)
  values (
    v_empresa_id,
    'admin',
    'Administrador',
    'Acceso completo (creado por bootstrap)',
    '["*"]'::jsonb,   -- comodín — tu deps.require_permiso ya hace bypass si rol = 'admin'
    true
  )
  on conflict (empresa_id, codigo) do nothing;

  select id into v_rol_id from public.roles_empresa
   where empresa_id = v_empresa_id and codigo = 'admin';

  -- 4. Vincular el usuario auth con la empresa
  insert into public.usuarios_empresa
    (empresa_id, user_id, rol_id, nombre, email, activo)
  values
    (v_empresa_id, v_user_id, v_rol_id, v_nombre, v_email::citext, true)
  on conflict (empresa_id, user_id) do update
     set rol_id = excluded.rol_id, activo = true, deleted_at = null;

  -- 5. Política de acceso por defecto (sin MFA, sin restricción de IP)
  insert into public.empresa_politicas_acceso (empresa_id) values (v_empresa_id)
    on conflict (empresa_id) do nothing;

  -- 6. Datos seed mínimos para que puedas probar el frontend de inmediato
  -- 6.1 Unidades de medida
  insert into public.unidades_medida (empresa_id, codigo, nombre, decimales)
  values
    (v_empresa_id, 'UN', 'Unidad', 0),
    (v_empresa_id, 'KG', 'Kilogramo', 3),
    (v_empresa_id, 'LT', 'Litro', 3),
    (v_empresa_id, 'CAJ', 'Caja', 0)
  on conflict (empresa_id, codigo) do nothing;

  select id into v_unidad_un_id from public.unidades_medida
   where empresa_id = v_empresa_id and codigo = 'UN';
  select id into v_unidad_kg_id from public.unidades_medida
   where empresa_id = v_empresa_id and codigo = 'KG';

  -- 6.2 Almacén central
  insert into public.almacenes (empresa_id, codigo, nombre, tipo, ciudad)
  values (v_empresa_id, 'CENTRAL', 'Almacén Central', 'fisico', 'La Paz')
  on conflict (empresa_id, codigo) do nothing;

  select id into v_almacen_id from public.almacenes
   where empresa_id = v_empresa_id and codigo = 'CENTRAL';

  -- ============================ RESULTADO ====================================
  raise notice '====================================================';
  raise notice 'BOOTSTRAP COMPLETADO';
  raise notice '====================================================';
  raise notice 'Empresa ID:        %', v_empresa_id;
  raise notice 'Usuario auth:      %', v_user_id;
  raise notice 'Email login:       %', v_email;
  raise notice 'Plan:              %', v_plan_codigo;
  raise notice 'Almacén CENTRAL:   %', v_almacen_id;
  raise notice 'Unidad UN ID:      %  (úsalo en el form de productos)', v_unidad_un_id;
  raise notice 'Unidad KG ID:      %', v_unidad_kg_id;
  raise notice '====================================================';
  raise notice 'Ya puedes loguear en http://localhost:5173 con tu email/password.';
end$$;

-- Opcional: verifica que todo quedó OK
-- select e.razon_social, ue.email, r.codigo as rol, s.estado, p.codigo as plan
--   from public.empresas e
--   join public.usuarios_empresa ue on ue.empresa_id = e.id
--   join public.roles_empresa r on r.id = ue.rol_id
--   join public.empresa_suscripciones s on s.empresa_id = e.id
--   join public.planes p on p.id = s.plan_id;
