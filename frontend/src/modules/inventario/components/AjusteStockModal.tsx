import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAlmacenes } from "@/modules/inventario/hooks/useAlmacenes";
import { useAjustarStock } from "@/modules/inventario/hooks/useStock";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const schema = z.object({
  almacen_id: z.string().uuid("Almacén requerido"),
  tipo: z.enum(["entrada", "salida", "ajuste"]),
  cantidad: z.coerce.number().positive("Cantidad debe ser positiva"),
  costo_unitario: z.coerce.number().min(0),
  motivo: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productoId: string;
  productoNombre: string;
}

export function AjusteStockModal({ open, onOpenChange, productoId, productoNombre }: Props) {
  const { data: almacenes = [] } = useAlmacenes();
  const ajustar = useAjustarStock();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      almacen_id: almacenes[0]?.id ?? "",
      tipo: "entrada",
      cantidad: 1,
      costo_unitario: 0,
      motivo: "",
    },
  });

  const submit = handleSubmit(async (values) => {
    await ajustar.mutateAsync({
      producto_id: productoId,
      ...values,
    });
    reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <p className="text-sm text-muted-foreground">{productoNombre}</p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="almacen_id">Almacén</Label>
            <select
              id="almacen_id"
              {...register("almacen_id")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} — {a.nombre}
                </option>
              ))}
            </select>
            {errors.almacen_id && (
              <p className="text-xs text-destructive">{errors.almacen_id.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de movimiento</Label>
            <select
              id="tipo"
              {...register("tipo")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input id="cantidad" type="number" step="0.01" {...register("cantidad")} />
              {errors.cantidad && (
                <p className="text-xs text-destructive">{errors.cantidad.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costo_unitario">Costo unitario</Label>
              <Input
                id="costo_unitario"
                type="number"
                step="0.01"
                {...register("costo_unitario")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Input id="motivo" {...register("motivo")} placeholder="Compra, merma, conteo..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={ajustar.isPending}>
              {ajustar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
