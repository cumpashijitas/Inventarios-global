import PlaceholderPage from "@/shared/components/PlaceholderPage";

// TODO: consultar productos donde stock_actual.cantidad <= productos.stock_minimo
export default function ReporteBajoStockPage() {
  return (
    <PlaceholderPage
      title="Bajo stock"
      description="Productos por debajo del mínimo configurado que requieren reposición."
    />
  );
}