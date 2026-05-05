import { PackageCheck } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: tabla recepciones + recepciones_detalle. Al confirmar,
// llamar a registrar_movimiento_stock por línea con costo prorrateado.
export default function RecepcionesPage() {
  return (
    <ModuleComingSoon
      icon={PackageCheck}
      title="Recepciones"
      description="Confirma la mercadería recibida y descarga al stock con costo prorrateado."
      plan="profesional"
      features={[
        "Recepción contra OC: marca cantidades recibidas vs pedidas",
        "Soporta recepción parcial; permite múltiples recepciones por OC",
        "Descarga al stock automática usando registrar_movimiento_stock",
        "Recálculo de costo promedio ponderado al recibir",
        "Diferencias documentadas (faltantes, sobrantes, dañados)",
        "Adjuntar fotos del lote recibido y guía de transporte",
      ]}
    />
  );
}