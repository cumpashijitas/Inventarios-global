import { FileText } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: tablas cotizaciones (cabecera) + cotizaciones_detalle (líneas).
// Conversión cotización→venta atómica con bloqueo de stock opcional.
export default function CotizacionesPage() {
  return (
    <ModuleComingSoon
      icon={FileText}
      title="Cotizaciones"
      description="Crea cotizaciones, envíalas por email y conviértelas en venta con un click."
      plan="profesional"
      features={[
        "Constructor de cotización con búsqueda rápida de productos",
        "Descuentos por línea o por total + impuestos automáticos",
        "Vencimiento configurable y estados (borrador, enviada, aceptada, vencida)",
        "PDF profesional con logo de la empresa, listo para enviar por email/WhatsApp",
        "Conversión cotización → venta en un click (sin re-tipear)",
        "Métricas: tasa de conversión por vendedor",
      ]}
    />
  );
}