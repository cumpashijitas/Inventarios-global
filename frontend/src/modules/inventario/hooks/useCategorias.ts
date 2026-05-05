import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import { extractApiError } from "@/shared/api/client";
import { useToast } from "@/shared/components/ui/toast";
import type { CategoriaIn } from "@/shared/types/api";

const KEY = ["categorias"];

export function useCategorias(only_active = true) {
  return useQuery({
    queryKey: [...KEY, { only_active }],
    queryFn: () => inventarioApi.listCategorias(only_active),
    staleTime: 60_000, // las categorías cambian poco
  });
}

export function useCreateCategoria() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (body: CategoriaIn) => inventarioApi.createCategoria(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ variant: "success", title: "Categoría creada" });
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "No se pudo crear",
        description: extractApiError(err).message,
      });
    },
  });
}

export function useUpdateCategoria() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<CategoriaIn> & { activo?: boolean }) =>
      inventarioApi.updateCategoria(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ variant: "success", title: "Categoría actualizada" });
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "No se pudo actualizar",
        description: extractApiError(err).message,
      });
    },
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => inventarioApi.deleteCategoria(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ variant: "success", title: "Categoría eliminada" });
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description: extractApiError(err).message,
      });
    },
  });
}
