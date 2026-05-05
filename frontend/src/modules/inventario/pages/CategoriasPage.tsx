import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  useCategorias,
  useCreateCategoria,
  useDeleteCategoria,
  useUpdateCategoria,
} from "@/modules/inventario/hooks/useCategorias";
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
import type { Categoria } from "@/shared/types/api";

const schema = z.object({
  nombre: z.string().min(1).max(120),
  parent_id: z.string().uuid().optional().nullable().or(z.literal("")),
  orden: z.coerce.number().int().min(0),
});
type FormValues = z.infer<typeof schema>;

export default function CategoriasPage() {
  const { data, isLoading } = useCategorias(false);
  const createMut = useCreateCategoria();
  const updateMut = useUpdateCategoria();
  const deleteMut = useDeleteCategoria();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: "", parent_id: "", orden: 0 },
  });

  const openNew = () => {
    setEditing(null);
    reset({ nombre: "", parent_id: "", orden: 0 });
    setOpen(true);
  };

  const openEdit = (c: Categoria) => {
    setEditing(c);
    reset({
      nombre: c.nombre,
      parent_id: c.parent_id ?? "",
      orden: c.orden,
    });
    setOpen(true);
  };

  const submit = handleSubmit(async (values) => {
    const body = {
      nombre: values.nombre,
      parent_id: values.parent_id || null,
      orden: values.orden,
    };
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, ...body });
    } else {
      await createMut.mutateAsync(body);
    }
    setOpen(false);
  });

  const handleDelete = (c: Categoria) => {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    deleteMut.mutate(c.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            Organiza tus productos en categorías jerárquicas.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Aún no hay categorías"
          description="Crea categorías para clasificar mejor tu catálogo."
          action={
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> Crear categoría
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Padre</TableHead>
                <TableHead className="text-right">Orden</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => {
                const parent = data.find((x) => x.id === c.parent_id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {parent?.nombre ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{c.orden}</TableCell>
                    <TableCell>
                      <span
                        className={
                          c.activo
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {c.activo ? "Activa" : "Inactiva"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(c)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...register("nombre")} autoFocus />
              {errors.nombre && (
                <p className="text-xs text-destructive">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="parent_id">Categoría padre (opcional)</Label>
              <select
                id="parent_id"
                {...register("parent_id")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Sin padre —</option>
                {data
                  ?.filter((x) => x.id !== editing?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="orden">Orden</Label>
              <Input id="orden" type="number" {...register("orden")} />
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
