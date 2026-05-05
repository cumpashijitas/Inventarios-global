import { CreditCard } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: tablas pagos, formas_pago. Trigger que actualiza el saldo
// de la venta y dispara recordatorio si queda pendiente.
export default function PagosPage() {
  return (
    <ModuleComingSoon
      icon={CreditCard}
      title="Pagos"
      description="Cobros, formas de pago y cuentas por cobrar con vencimientos."
      plan="profesional"
      features={[
        "Múltiples formas de pago (efectivo, transferencia, tarjeta, QR)",
        "Pagos parciales y a cuenta",
        "Cuentas por cobrar agrupadas por cliente con antigüedad de saldos",
        "Conciliación de pagos contra ventas pendientes",
        "Reporte de cobranzas por vendedor y por período",
        "Recordatorios automáticos (con addon Notificaciones)",
      ]}
    />
  );
}