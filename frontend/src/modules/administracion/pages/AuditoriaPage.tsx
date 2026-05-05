import { ShieldCheck } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: GET /api/v1/auditoria con filtros (rango fechas, usuario,
// módulo, entidad, acción). Tabla auditoria ya existe y se llena
// automáticamente desde cada use case.
export default function AuditoriaPage() {
  return (
    <ModuleComingSoon
      icon={ShieldCheck}
      title="Auditoría"
      description="Quién hizo qué, cuándo y desde dónde. Trazabilidad completa de cambios."
      plan="core"
      features={[
        "Log de cada mutación: usuario, fecha, módulo, entidad, acción",
        "Filtros por usuario, fecha, módulo, entidad o acción",
        "Diff visual: payload_antes vs payload_despues",
        "IP y user-agent del request, útil para investigar incidentes",
        "Inmutable (UPDATE/DELETE bloqueado por RLS)",
        "Exportable a CSV para análisis offline o cumplimiento legal",
      ]}
    />
  );
}