-- ──────────────────────────────────────────────────────────────────────────────
-- 10 — Campos de contacto en la tabla empresas
-- Ejecutar una sola vez después de 01-schema.sql
-- ──────────────────────────────────────────────────────────────────────────────
alter table public.empresas
  add column if not exists direccion  text,
  add column if not exists ciudad     text,
  add column if not exists telefono   text,
  add column if not exists email      text;

-- Demo: actualizar la empresa existente con datos de ejemplo
update public.empresas
   set direccion = 'Av. Principal N45-123 y Colón',
       ciudad    = 'Tarija - Bolivia',
       telefono  = '+591 4 6654321',
       email     = 'ventas@autorepuestos.bo'
 where deleted_at is null;
