import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { Producto, ProductoIn } from "@/shared/types/api";

const schema = z.object({
  sku: z.string().min(1, "Requerido").max(50),
  nombre: z.string().min(1, "Requerido").max(200),
  descripcion: z.string().optional().nullable(),
  unidad_id: z.string().uuid("Selecciona una unidad válida"),
  precio_compra: z.coerce.number().min(0),
  precio_venta: z.coerce.number().min(0),
  stock_minimo: z.coerce.number().min(0),
  controla_stock: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto?: Producto | null;
  onSubmit: (data: ProductoIn) => Promise<void> | void;
  loading?: boolean;
}

export function ProductoForm({
  open,
  onOpenChange,
  producto,
  onSubmit,
  loading = false,
}: Props) {
  const isEdit = Boolean(producto);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: producto
      ? {
          sku: producto.sku,
          nombre: producto.nombre,
          descripcion: producto.descripcion ?? "",
          unidad_id: producto.unidad_id,
          precio_compra: Number.parseFloat(producto.precio_compra),
          precio_venta: Number.parseFloat(producto.precio_venta),
          stock_minimo: Number.parseFloat(producto.stock_minimo),
          controla_stock: producto.controla_stock,
        }
      : {
          sku: "",
          nombre: "",
          descripcion: "",
          unidad_id: "",
          precio_compra: 0,
          precio_venta: 0,
          stock_minimo: 0,
          controla_stock: true,
        },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      moneda: "BOB",
    });
    reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            Datos básicos. Más campos como categoría e imagen se podrán editar luego.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...register("sku")} disabled={isEdit} />
              {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unidad_id">Unidad ID (UUID)</Label>
              <Input id="unidad_id" {...register("unidad_id")} placeholder="uuid de la unidad" />
              {errors.unidad_id && (
                <p className="text-xs text-destructive">{errors.unidad_id.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...register("nombre")} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input id="descripcion" {...register("descripcion")} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="precio_compra">P. compra</Label>
              <Input
                id="precio_compra"
                type="number"
                step="0.01"
                {...register("precio_compra")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="precio_venta">P. venta</Label>
              <Input
                id="precio_venta"
                type="number"
                step="0.01"
                {...register("precio_venta")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock_minimo">Stock min.</Label>
              <Input
                id="stock_minimo"
                type="number"
                step="0.01"
                {...register("stock_minimo")}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("controla_stock")} className="h-4 w-4" />
            Controla stock (desmarcar para servicios)
          </label>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
