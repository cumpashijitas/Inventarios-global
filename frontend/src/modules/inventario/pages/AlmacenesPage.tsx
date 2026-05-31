import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAlmacenes, useCreateAlmacen } from "@/modules/inventario/hooks/useAlmacenes";
import { EmptyState } from "@/shared/components/EmptyState";
import { Skeleton } from "@/shared/components/Skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

const schema = z.object({
  codigo: z.string().min(1).max(30),
  nombre: z.string().min(1).max(120),
  tipo: z.enum(["fisico", "movil", "consigna"]),
  ciudad: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof schema>;

export default function AlmacenesPage() {
  const { data, isLoading } = useAlmacenes(false);
  const createMut = useCreateAlmacen();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { codigo: "", nombre: "", tipo: "fisico" },
  });

  const submit = handleSubmit(async (values) => {
    await createMut.mutateAsync(values);
    reset();
    setOpen(false);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Almacenes</h1>
          <p className="text-sm text-muted-foreground">
            Sucursales, depósitos o vehículos donde se mueve el stock.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo almacén
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Aún no tienes almacenes"
          description="Crea al menos uno antes de cargar stock."
          action={
            <Button onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Crear almacén
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.codigo}</TableCell>
                  <TableCell className="font-medium">{a.nombre}</TableCell>
                  <TableCell className="capitalize">{a.tipo}</TableCell>
                  <TableCell>{a.ciudad ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={
                        a.activo
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {a.activo ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo almacén</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" {...register("codigo")} placeholder="CENTRAL" />
                {errors.codigo && (
                  <p className="text-xs text-destructive">{errors.codigo.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  {...register("tipo")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="fisico">Físico</option>
                  <option value="movil">Móvil (vehículo)</option>
                  <option value="consigna">Consigna</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && (
                <p className="text-xs text-destructive">{errors.nombre.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input id="ciudad" {...register("ciudad")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direccion">Dirección</Label>
                <Input id="direccion" {...register("direccion")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
