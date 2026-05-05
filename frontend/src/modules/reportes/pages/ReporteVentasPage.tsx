import { TrendingUp } from "lucide-react";

import { ModuleComingSoon } from "@/shared/components/ModuleComingSoon";

// TODO backend: vistas materializadas sobre ventas + ventas_detalle.
// Filtros por rango, agrupación por dimensión (cliente, producto, vendedor).
export default function ReporteVentasPage() {
  return (
    <ModuleComingSoon
      icon={TrendingUp}
      title="Reporte de ventas"
      description="Análisis de ventas por período, producto, cliente y vendedor."
      plan="profesional"
      features={[
        "Ventas del día / semana / mes / año (con comparación vs período anterior)",
        "Ranking de productos top vendidos (por unidades y por monto)",
        "Ranking de clientes top con frecuencia de compra",
        "Ranking de vendedores con métrica de comisiones (con módulo Distribuidora)",
        "Margen bruto por producto y por categoría",
        "Gráficos: línea de tiempo, torta por categoría, mapa de calor por hora/día",
      ]}
    />
  );
}