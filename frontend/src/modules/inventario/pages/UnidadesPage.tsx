import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, PowerOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  useCreateUnidad,
  useDesactivarUnidad,
  useUnidades,
  useUpdateUnidad,
} from "@/modules/inventario/hooks/useUnidades";
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
import type { Unidad } from "@/shared/types/api";

const schema = z.object({
  codigo: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "Solo alfanumérico"),
  nombre: z.string().min(1).max(60),
  decimales: z.coerce.number().int().min(0).max(6),
});
type FormValues = z.infer<typeof schema>;

export default function UnidadesPage() {
  const { data, isLoading } = useUnidades(false);
  const createMut = useCreateUnidad();
  const updateMut = useUpdateUnidad();
  const desactivarMut = useDesactivarUnidad();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unidad | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { codigo: "", nombre: "", decimales: 0 },
  });

  const openNew = () => {
    setEditing(null);
    reset({ codigo: "", nombre: "", decimales: 0 });
    setOpen(true);
  };

  const openEdit = (u: Unidad) => {
    setEditing(u);
    reset({ codigo: u.codigo, nombre: u.nombre, decimales: u.decimales });
    setOpen(true);
  };

  const submit = handleSubmit(async (values) => {
    if (editing) {
      // El código no se edita (es identificador del catálogo de la empresa)
      await updateMut.mutateAsync({
        id: editing.id,
        nombre: values.nombre,
        decimales: values.decimales,
      });
    } else {
      await createMut.mutateAsync({
        codigo: values.codigo.toUpperCase(),
        nombre: values.nombre,
        decimales: values.decimales,
      });
    }
    setOpen(false);
  });

  const handleDesactivar = (u: Unidad) => {
    if (
      !confirm(
        `¿Desactivar la unidad "${u.codigo}"? Los productos que la usan no se ven afectados.`,
      )
    )
      return;
    desactivarMut.mutate(u.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Unidades de medida</h1>
          <p className="text-sm text-muted-foreground">
            Define las unidades en las que se vende y mide tu catálogo (UN, KG, LT, CAJA…).
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nueva unidad
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Aún no hay unidades"
          description="Crea las unidades de medida que usarás en tus productos."
          action={
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> Crear unidad
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
                <TableHead className="text-right">Decimales</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.codigo}</TableCell>
                  <TableCell className="font-medium">{u.nombre}</TableCell>
                  <TableCell className="text-right">{u.decimales}</TableCell>
                  <TableCell>
                    <span
                      className={
                        u.activo
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {u.activo ? "Activa" : "Inactiva"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.activo && (
                      <Button size="icon" variant="ghost" onClick={() => handleDesactivar(u)}>
                        <PowerOff className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
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
            <DialogTitle>{editing ? "Editar unidad" : "Nueva unidad"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  className="uppercase"
                  {...register("codigo")}
                  disabled={!!editing}
                  placeholder="UN"
                />
                {errors.codigo && (
                  <p className="text-xs text-destructive">{errors.codigo.message}</p>
                )}
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" {...register("nombre")} placeholder="Unidad" />
                {errors.nombre && (
                  <p className="text-xs text-destructive">{errors.nombre.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="decimales">Decimales (0 = enteros, 3 = milésimas)</Label>
              <Input id="decimales" type="number" min={0} max={6} {...register("decimales")} />
              {errors.decimales && (
                <p className="text-xs text-destructive">{errors.decimales.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editing ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
