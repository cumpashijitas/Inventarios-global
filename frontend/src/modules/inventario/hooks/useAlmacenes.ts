import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import { extractApiError } from "@/shared/api/client";
import { useToast } from "@/shared/components/ui/toast";
import type { AlmacenIn } from "@/shared/types/api";

export function useAlmacenes(only_active = true) {
  return useQuery({
    queryKey: ["almacenes", { only_active }],
    queryFn: () => inventarioApi.listAlmacenes(only_active),
  });
}

export function useCreateAlmacen() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (body: AlmacenIn) => inventarioApi.createAlmacen(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["almacenes"] });
      toast({ variant: "success", title: "Almacén creado" });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast({
        variant: "destructive",
        title: "No se pudo crear el almacén",
        description: e.message,
      });
    },
  });
}
