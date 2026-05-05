import { useQuery } from "@tanstack/react-query";

import { inventarioApi } from "@/modules/inventario/services/inventarioApi";

export function useReporteInventario(almacen_id?: string) {
  return useQuery({
    queryKey: ["reporte-inventario", { almacen_id }],
    queryFn: () => inventarioApi.reporteInventario(almacen_id),
    staleTime: 30_000,
  });
}

export function useReporteMovimientos(params: {
  desde?: string;
  hasta?: string;
  producto_id?: string;
  almacen_id?: string;
  tipo?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["reporte-movimientos", params],
    queryFn: () => inventarioApi.reporteMovimientos(params),
    placeholderData: (prev) => prev,
  });
}

export function useReporteBajoStock() {
  return useQuery({
    queryKey: ["reporte-bajo-stock"],
    queryFn: () => inventarioApi.reporteBajoStock(),
  });
}
