import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import { extractApiError } from "@/shared/api/client";
import { useToast } from "@/shared/components/ui/toast";
import type { ProductoIn } from "@/shared/types/api";

const KEYS = {
  list: (params: object) => ["productos", "list", params] as const,
  detail: (id: string) => ["productos", "detail", id] as const,
};

export function useProductos(params: {
  page: number;
  page_size: number;
  search?: string;
  only_active?: boolean;
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => inventarioApi.listProductos(params),
    placeholderData: (prev) => prev, // mantiene datos previos al cambiar página
  });
}

export function useCreateProducto() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (body: ProductoIn) => inventarioApi.createProducto(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productos"] });
      toast({ variant: "success", title: "Producto creado" });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast({
        variant: "destructive",
        title: "No se pudo crear el producto",
        description: e.message,
      });
    },
  });
}

export function useUpdateProducto(id: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (body: Partial<ProductoIn>) => inventarioApi.updateProducto(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productos"] });
      toast({ variant: "success", title: "Producto actualizado" });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast({
        variant: "destructive",
        title: "No se pudo actualizar",
        description: e.message,
      });
    },
  });
}

export function useDeleteProducto() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => inventarioApi.deleteProducto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productos"] });
      toast({ variant: "success", title: "Producto eliminado" });
    },
    onError: (err) => {
      const e = extractApiError(err);
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description: e.message,
      });
    },
  });
}
