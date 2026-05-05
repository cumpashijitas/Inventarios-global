import { ShoppingCart } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: tablas ventas + ventas_detalle. Trigger que al cerrar venta
// llama a registrar_movimiento_stock por cada línea (descarga atómica).
// Anulación con reverso automático del stock.
export default function VentasPage() {
  return (
    <ModuleComingSoon
      icon={ShoppingCart}
      title="Ventas"
      description="Punto de venta rápido teclado-friendly + flujo cotización → venta → cobro."
      plan="profesional"
      features={[
        "POS con búsqueda por SKU, código de barras o nombre",
        "Descuentos por línea o totales, impuestos configurables",
        "Selección de almacén origen al vender",
        "Descarga automática de stock con costo promedio",
        "Anulación con reverso de stock auditado",
        "Tickets, facturas y notas de crédito imprimibles",
      ]}
    />
  );
}