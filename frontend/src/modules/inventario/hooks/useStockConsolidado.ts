import { useQuery } from "@tanstack/react-query";

import { inventarioApi } from "@/modules/inventario/services/inventarioApi";

interface Params {
  page: number;
  page_size: number;
  almacen_id?: string;
  search?: string;
  only_low_stock?: boolean;
}

export function useStockConsolidado(params: Params) {
  return useQuery({
    queryKey: ["stock-consolidado", params],
    queryFn: () => inventarioApi.stockConsolidado(params),
    placeholderData: (prev) => prev,
  });
}
