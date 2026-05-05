import { AlertCircle, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { useAlmacenes } from "@/modules/inventario/hooks/useAlmacenes";
import { useStockConsolidado } from "@/modules/inventario/hooks/useStockConsolidado";
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
import { formatMoney, formatNumber } from "@/shared/lib/format";

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function StockPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [almacenId, setAlmacenId] = useState<string>("");
  const [onlyLow, setOnlyLow] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: almacenes = [] } = useAlmacenes();
  const { data, isLoading } = useStockConsolidado({
    page,
    page_size: 50,
    search: debouncedSearch || undefined,
    almacen_id: almacenId || undefined,
    only_low_stock: onlyLow,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stock actual</h1>
        <p className="text-sm text-muted-foreground">
          Existencias por producto y almacén con valorización al costo promedio.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Combinaciones (producto × almacén)"
          value={data ? data.total.toLocaleString() : "—"}
        />
        <KpiCard
          label="Valor total del inventario"
          value={data ? formatMoney(data.valor_total) : "—"}
        />
        <KpiCard
          label="Productos bajo mínimo"
          value={data ? data.bajo_minimo_count.toLocaleString() : "—"}
          danger={data ? data.bajo_minimo_count > 0 : false}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por SKU o nombre"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <select
          value={almacenId}
          onChange={(e) => {
            setPage(1);
            setAlmacenId(e.target.value);
          }}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Todos los almacenes</option>
          {almacenes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigo} — {a.nombre}
            </option>
          ))}
        </select>
        <Button
          variant={onlyLow ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setPage(1);
            setOnlyLow((v) => !v);
          }}
          className="gap-1.5"
        >
          <AlertCircle className="h-4 w-4" />
          Bajo mínimo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={search || onlyLow || almacenId ? "Sin resultados" : "Aún no hay stock"}
          description={
            search || onlyLow || almacenId
              ? "Probá con otros filtros."
              : "Carga stock desde la página de productos con el botón 'Ajustar stock'."
          }
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Costo prom.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={`${row.producto_id}-${row.almacen_id}`}>
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell className="font-medium">{row.producto_nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.almacen_codigo} — {row.almacen_nombre}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(row.cantidad)}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(row.costo_promedio)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(row.valor)}
                    </TableCell>
                    <TableCell>
                      {row.bajo_minimo && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
                          title={`Stock mínimo: ${formatNumber(row.stock_minimo)}`}
                        >
                          <AlertCircle className="h-3 w-3" />
                          Bajo mín.
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

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
    </div>
  );
}

function KpiCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${danger ? "text-rose-600" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
