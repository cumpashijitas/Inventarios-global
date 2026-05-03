import { Boxes, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AjusteStockModal } from "@/modules/inventario/components/AjusteStockModal";
import { ProductoForm } from "@/modules/inventario/components/ProductoForm";
import {
  useCreateProducto,
  useDeleteProducto,
  useProductos,
  useUpdateProducto,
} from "@/modules/inventario/hooks/useProductos";
import { EmptyState } from "@/shared/components/EmptyState";
import { Skeleton } from "@/shared/components/Skeleton";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatMoney } from "@/shared/lib/format";
import type { Producto, ProductoIn } from "@/shared/types/api";

export default function ProductosPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useProductos({
    page,
    page_size: 25,
    search: debouncedSearch || undefined,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [stockProducto, setStockProducto] = useState<Producto | null>(null);

  const createMut = useCreateProducto();
  const updateMut = useUpdateProducto(editing?.id ?? "");
  const deleteMut = useDeleteProducto();

  const handleSubmit = async (body: ProductoIn) => {
    if (editing) {
      await updateMut.mutateAsync(body);
    } else {
      await createMut.mutateAsync(body);
    }
  };

  const handleEdit = (p: Producto) => {
    setEditing(p);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleDelete = (p: Producto) => {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción se puede revertir desde auditoría.`)) {
      return;
    }
    deleteMut.mutate(p.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">Catálogo y stock mínimo</p>
        </div>
        <Button onClick={handleNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o SKU"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={search ? "Sin resultados" : "Aún no hay productos"}
          description={
            search
              ? "Probá con otro término o limpia la búsqueda."
              : "Comienza creando tu primer producto. Lo necesitarás antes de cargar stock."
          }
          action={
            !search && (
              <Button onClick={handleNew} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Crear producto
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">P. compra</TableHead>
                  <TableHead className="text-right">P. venta</TableHead>
                  <TableHead className="text-right">Stock min.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(p.precio_compra)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(p.precio_venta)}
                    </TableCell>
                    <TableCell className="text-right">{p.stock_minimo}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setStockProducto(p)}
                          aria-label="Ajustar stock"
                          title="Ajustar stock"
                        >
                          <Boxes className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(p)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(p)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Mostrando {data.items.length} de {data.total} · página {data.page} de{" "}
              {data.total_pages}
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      <ProductoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        producto={editing}
        onSubmit={handleSubmit}
        loading={createMut.isPending || updateMut.isPending}
      />

      {stockProducto && (
        <AjusteStockModal
          open={Boolean(stockProducto)}
          onOpenChange={(o) => !o && setStockProducto(null)}
          productoId={stockProducto.id}
          productoNombre={stockProducto.nombre}
        />
      )}
    </div>
  );
}

// --- mini hook de debounce inline para no inflar shared con un archivo de 5 líneas ---
import { useEffect, useState as useStateHook } from "react";
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useStateHook(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
