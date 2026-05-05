import { Truck } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: tablas proveedores, productos_proveedor, condiciones_pago.
export default function ProveedoresPage() {
  return (
    <ModuleComingSoon
      icon={Truck}
      title="Proveedores"
      description="Directorio de proveedores con condiciones comerciales y catálogo asociado."
      plan="profesional"
      features={[
        "Datos fiscales del proveedor + cuentas bancarias",
        "Plazos de pago y términos comerciales por proveedor",
        "Productos que cada proveedor vende, con precio último y promedio",
        "Lead time de entrega para cada producto",
        "Historial de órdenes de compra y cumplimiento",
        "Calificación interna del proveedor (1-5)",
      ]}
    />
  );
}