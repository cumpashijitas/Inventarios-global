import { Building2 } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: PATCH /api/v1/empresa con validaciones y subida de logo
// a Supabase Storage. Solo rol admin.
export default function EmpresaPage() {
  return (
    <ModuleComingSoon
      icon={Building2}
      title="Empresa"
      description="Datos fiscales, logo, configuración regional y branding de tu empresa."
      plan="core"
      features={[
        "Razón social, nombre comercial, NIT/RUC y datos de contacto",
        "Logo y favicon (se reflejan en topbar, facturas y PDFs)",
        "Zona horaria, moneda principal, idioma del sistema",
        "Configuración fiscal por país (IVA, retenciones, formato de facturación)",
        "Pie de página personalizable para documentos imprimibles",
        "Preferencias visuales: tema claro/oscuro forzado",
      ]}
    />
  );
}