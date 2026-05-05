import { AlertCircle } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: vista que une productos con stock_actual donde
// cantidad <= stock_minimo. Sugerencia de reorden basada en consumo histórico.
export default function ReporteBajoStockPage() {
  return (
    <ModuleComingSoon
      icon={AlertCircle}
      title="Bajo stock"
      description="Productos por debajo del mínimo, ordenados por urgencia, con sugerencia de reorden."
      plan="basico"
      features={[
        "Lista de productos con stock_actual ≤ stock_mínimo, por almacén",
        "Sugerencia de cantidad a reordenar (basada en consumo histórico)",
        "Lead time del proveedor: días estimados hasta cubrir el faltante",
        "Generación masiva de OC desde la lista (con módulo Compras)",
        "Alertas configurables: email/WhatsApp cuando un producto cruza el mínimo",
        "Historial de quiebres de stock para análisis posterior",
      ]}
    />
  );
}