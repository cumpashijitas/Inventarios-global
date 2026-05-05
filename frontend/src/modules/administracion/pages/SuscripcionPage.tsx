import { Sparkles } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: GET /api/v1/empresa/suscripcion (plan + addons activos
// + estado de cobro). POST /api/v1/empresa/upgrade (cambiar plan).
// Integración con pasarela de pago al final.
export default function SuscripcionPage() {
  return (
    <ModuleComingSoon
      icon={Sparkles}
      title="Suscripción y módulos"
      description="Plan actual, addons contratados, próximo cobro y gestión de upgrade/downgrade."
      plan="core"
      features={[
        "Plan actual con badge (Básico / Profesional / Distribuidora / Empresarial)",
        "Lista de addons activos con precio mensual y fecha de inicio",
        "Comparativo entre planes con CTA de upgrade",
        "Catálogo de addons disponibles (IA, e-commerce, geolocalización, etc.)",
        "Próximo cobro: fecha y monto",
        "Historial de facturas pagadas",
      ]}
    />
  );
}