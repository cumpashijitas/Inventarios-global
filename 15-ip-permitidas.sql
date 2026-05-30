-- ============================================================
-- Tabla: ip_permitidas
-- Whitelist de IPs por empresa para restricción de acceso.
-- Si la tabla está vacía para una empresa = sin restricción.
-- El rol 'admin' siempre bypassa la verificación.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ip_permitidas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ip          text        NOT NULL CHECK (length(ip) >= 7),
  descripcion text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ip)
);

ALTER TABLE public.ip_permitidas ENABLE ROW LEVEL SECURITY;

-- Solo el tenant actual puede ver/gestionar sus IPs
CREATE POLICY "tenant_ip_permitidas" ON public.ip_permitidas
  USING (empresa_id::text = current_setting('app.empresa_id', true));

-- Índice para la verificación en cada request
CREATE INDEX IF NOT EXISTS idx_ip_permitidas_empresa
  ON public.ip_permitidas (empresa_id);
