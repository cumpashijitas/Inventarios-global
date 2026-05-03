# Inventario SaaS — bundle inicial

Punto de partida del proyecto.

| # | Archivo | Qué hace |
|---|---------|----------|
| 0 | [`00-BLUEPRINT.md`](./00-BLUEPRINT.md) | Decisiones arquitectónicas, stack, estructura de carpetas backend/frontend, modelo multi-tenant, principios UX. |
| 1 | [`01-schema.sql`](./01-schema.sql) | DDL completo: control (planes/módulos/suscripciones), usuarios y seguridad, auditoría, módulo inventario base. |
| 2 | [`02-rls.sql`](./02-rls.sql) | Versión genérica/portable de las políticas RLS (rol `app_user`). Útil para Postgres puro / CI. |
| 2b | [`02b-rls-supabase-patch.sql`](./02b-rls-supabase-patch.sql) | **Parche obligatorio si usas Supabase.** Reemplaza las policies para usar el rol nativo `authenticated` y leer `empresa_id` del JWT. |
| 3 | [`03-seed.sql`](./03-seed.sql) | Carga catálogo: 4 planes (Básico/Profesional/Distribuidora/Empresarial) y módulos (core + addons). |
| 4 | [`04-ROADMAP.md`](./04-ROADMAP.md) | Roadmap por fases con sprints, definición de "listo" por fase, checklist de producción. |

---

## Cómo aplicar la base de datos en Supabase

Ejecutar en este orden en el **SQL Editor** del proyecto Supabase:

1. `01-schema.sql`
2. `02-rls.sql`
3. `03-seed.sql`
4. **`02b-rls-supabase-patch.sql`**  ← obligatorio en Supabase

Verifica el seed:

```sql
select p.codigo as plan, count(*) as modulos
  from public.planes p
  join public.plan_modulos pm on pm.plan_id = p.id
 group by p.codigo order by p.orden;
```

Debe devolver: `basico=2, profesional=6, distribuidora=8, empresarial=12`.

Verifica que RLS esté activo en todas las tablas operativas:

```sql
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
 order by tablename;
```

Todas deben tener `rowsecurity = true`.

---

## Por qué tu test inicial no funcionó

Dos cosas pasan en Supabase que rompen el procedimiento "ingenuo" de testing:

1. **El SQL Editor corre como `postgres` (superuser)** — y los superusers **bypassean RLS por defecto**. Si haces `select * from productos` en el editor, ves todo aunque RLS esté activo. Tu primer test no probó nada.
2. **No existe el rol `app_user`** — Supabase usa los roles nativos `anon`, `authenticated`, `service_role`. Por eso `set role app_user` te falló.

El parche `02b-rls-supabase-patch.sql` resuelve esto: usa `authenticated` (el rol estándar) y lee el `empresa_id` del JWT del usuario logueado.

---

## Cómo testear RLS correctamente desde el SQL Editor de Supabase

Hay dos formas. Ambas funcionan después de aplicar el parche.

### Opción A — Simular un JWT con `set local` (recomendado)

Esta es la forma idiomática en Supabase porque `current_empresa_id()` ya lee de `request.jwt.claims`.

Paso 1 — Como `postgres`, crea dos empresas de prueba:

```sql
insert into public.empresas (razon_social) values ('Empresa A') returning id;
insert into public.empresas (razon_social) values ('Empresa B') returning id;
-- copia los dos UUIDs
```

Paso 2 — En **una nueva query**, simula al usuario de la Empresa A. Todo va junto en el mismo bloque (las `set local` solo viven dentro de la transacción):

```sql
begin;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","empresa_id":"<UUID_DE_A>","role":"authenticated"}';

-- Inserta un almacén para A
insert into public.almacenes (empresa_id, codigo, nombre)
values ('<UUID_DE_A>', 'CENTRAL', 'A central');

-- Debe ver SOLO los almacenes de A
select id, empresa_id, codigo from public.almacenes;

commit;
```

Paso 3 — En **otra query**, simula al usuario de la Empresa B y confirma que NO ve nada de A:

```sql
begin;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000002","empresa_id":"<UUID_DE_B>","role":"authenticated"}';

-- Debe devolver 0 filas (porque solo existe el almacén de A)
select id, empresa_id, codigo from public.almacenes;

-- Inserta uno para B
insert into public.almacenes (empresa_id, codigo, nombre)
values ('<UUID_DE_B>', 'CENTRAL', 'B central');

-- Debe ver SOLO el de B
select id, empresa_id, codigo from public.almacenes;

commit;
```

Paso 4 — Intentar inyección cruzada (debe fallar):

```sql
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","empresa_id":"<UUID_DE_A>","role":"authenticated"}';

-- Esto debe lanzar error: new row violates row-level security policy
insert into public.almacenes (empresa_id, codigo, nombre)
values ('<UUID_DE_B>', 'HACK', 'inyectado');

rollback;
```

Si los 4 pasos se comportan como descrito, **RLS está aislando correctamente** y puedes seguir construyendo backend.

### Opción B — Probar con la API real de Supabase

Crea dos usuarios reales en el dashboard de Supabase (Authentication → Users), asígnales `empresa_id` distintos en sus claims (vía Custom Access Token Hook, lo cubrimos al hacer el módulo de auth en el backend), y haz dos peticiones REST con cada JWT. Esta opción es más fiel a producción pero requiere la hook configurada — la dejamos para cuando armemos el módulo `auth` del backend.

---

## Qué viene después

Una vez validada la DB:
- `backend/` con FastAPI + arquitectura hexagonal + middleware de tenant + módulo inventario funcional.
- `frontend/` con React + Vite + TS + shadcn + login + módulo inventario.

Ver el detalle en `04-ROADMAP.md` (Fase 0 / Fase 1).
