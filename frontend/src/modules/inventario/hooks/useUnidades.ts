import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import { extractApiError } from "@/shared/api/client";
import { useToast } from "@/shared/components/ui/toast";
import type { UnidadIn } from "@/shared/types/api";

const KEY = ["unidades"];

export function useUnidades(only_active = true) {
  return useQuery({
    queryKey: [...KEY, { only_active }],
    queryFn: () => inventarioApi.listUnidades(only_active),
    staleTime: 60_000,
  });
}

export function useCreateUnidad() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (body: UnidadIn) => inventarioApi.createUnidad(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ variant: "success", title: "Unidad creada" });
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

export function useUpdateUnidad() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<UnidadIn> & { activo?: boolean }) =>
      inventarioApi.updateUnidad(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ variant: "success", title: "Unidad actualizada" });
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

export function useDesactivarUnidad() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => inventarioApi.desactivarUnidad(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ variant: "success", title: "Unidad desactivada" });
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "No se pudo desactivar",
        description: extractApiError(err).message,
      });
    },
  });
}
