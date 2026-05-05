import { Users } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: módulo `clientes`. Tablas: clientes, contactos, direcciones.
export default function ClientesPage() {
  return (
    <ModuleComingSoon
      icon={Users}
      title="Clientes"
      description="Catálogo de clientes con historial, segmentación y datos de contacto."
      plan="profesional"
      features={[
        "Ficha cliente con datos fiscales (NIT/CI), dirección y contactos múltiples",
        "Historial de compras, pagos y cuentas por cobrar",
        "Segmentación: tipo de cliente, zona, vendedor asignado",
        "Importación masiva desde Excel/CSV",
        "Búsqueda instantánea por nombre, NIT o teléfono",
        "Notas internas y archivos adjuntos por cliente",
      ]}
    />
  );
}