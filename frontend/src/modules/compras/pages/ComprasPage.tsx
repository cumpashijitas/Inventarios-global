import { ShoppingCart } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: tablas compras + compras_detalle. Estados: borrador,
// enviada, parcial, recibida, cancelada. Aprobaciones según monto.
export default function ComprasPage() {
  return (
    <ModuleComingSoon
      icon={ShoppingCart}
      title="Compras"
      description="Órdenes de compra con flujo de aprobación y trazabilidad."
      plan="profesional"
      features={[
        "Generación de OC desde sugerencia de reorden o manual",
        "Flujo de aprobación por monto (configurable por empresa)",
        "Recepción parcial o completa, link a documento de recepción",
        "Costos: precio + flete + impuestos prorrateado por línea",
        "PDF/email de OC con datos del proveedor y empresa",
        "Comparación de precios entre proveedores para el mismo producto",
      ]}
    />
  );
}