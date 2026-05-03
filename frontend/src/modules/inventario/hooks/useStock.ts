import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import { extractApiError } from "@/shared/api/client";
import { useToast } from "@/shared/components/ui/toast";
import type { AjusteStockIn } from "@/shared/types/api";

export function useMovimientos(params: {
  producto_id?: string;
  almacen_id?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["movimientos", params],
    queryFn: () => inventarioApi.listMovimientos(params),
  });
}

export function useAjustarStock() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (body: AjusteStockIn) => inventarioApi.ajustarStock(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["productos"] });
      toast({ variant: "success", title: "Movimiento registrado" });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast({
        variant: "destructive",
        title: "No se pudo registrar",
        description: e.message,
      });
    },
  });
}
