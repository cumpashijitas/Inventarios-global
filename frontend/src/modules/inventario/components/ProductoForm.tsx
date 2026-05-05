import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCategorias } from "@/modules/inventario/hooks/useCategorias";
import { useUnidades } from "@/modules/inventario/hooks/useUnidades";
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
  unidad_id: z.string().uuid("Selecciona una unidad"),
  categoria_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal("")),
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
  const { data: unidades = [], isLoading: unidadesLoading } = useUnidades();
  const { data: categorias = [], isLoading: categoriasLoading } = useCategorias();

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
          categoria_id: producto.categoria_id ?? "",
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
          categoria_id: "",
          precio_compra: 0,
          precio_venta: 0,
          stock_minimo: 0,
          controla_stock: true,
        },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      categoria_id: values.categoria_id || null,
      moneda: "BOB",
    });
    reset();
    onOpenChange(false);
  });

  // Si no hay unidades creadas, no podemos crear productos.
  const noUnidades = !unidadesLoading && unidades.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            Datos básicos. La imagen y otros campos se editan luego.
          </DialogDescription>
        </DialogHeader>

        {noUnidades ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Necesitas crear al menos una <strong>unidad de medida</strong> antes de crear
            productos. Ve a <strong>Operación → Unidades</strong>.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" {...register("sku")} disabled={isEdit} />
                {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unidad_id">Unidad</Label>
                <select
                  id="unidad_id"
                  {...register("unidad_id")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Selecciona —</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.codigo} — {u.nombre}
                    </option>
                  ))}
                </select>
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
              <Label htmlFor="categoria_id">Categoría (opcional)</Label>
              <select
                id="categoria_id"
                {...register("categoria_id")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={categoriasLoading}
              >
                <option value="">— Sin categoría —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
