import { useState } from "react";

import { useAlmacenes } from "@/modules/inventario/hooks/useAlmacenes";
import { useReporteInventario } from "@/modules/inventario/hooks/useReportes";
import { Skeleton } from "@/shared/components/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatMoney, formatNumber } from "@/shared/lib/format";

export default function ReporteInventarioPage() {
  const [almacenId, setAlmacenId] = useState<string>("");
  const { data: almacenes = [] } = useAlmacenes();
  const { data, isLoading } = useReporteInventario(almacenId || undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reporte de inventario</h1>
          <p className="text-sm text-muted-foreground">
            Valorización del stock y distribución por categoría.
          </p>
        </div>
        <select
          value={almacenId}
          onChange={(e) => setAlmacenId(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Todos los almacenes</option>
          {almacenes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigo} — {a.nombre}
            </option>
          ))}
        </select>
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Productos con stock" value={data.kpis.productos_con_stock.toLocaleString()} />
            <Kpi label="Combinaciones" value={data.kpis.combinaciones.toLocaleString()} />
            <Kpi label="Unidades totales" value={formatNumber(data.kpis.unidades_totales)} />
            <Kpi label="Valor total" value={formatMoney(data.kpis.valor_total)} />
            <Kpi
              label="Bajo mínimo"
              value={data.kpis.bajo_minimo_count.toLocaleString()}
              danger={data.kpis.bajo_minimo_count > 0}
            />
          </div>

          {/* Top 10 por valor */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Top productos por valor inmovilizado
            </h2>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_valor.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        Sin datos
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.top_valor.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell className="text-right">{formatNumber(p.cantidad)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(p.valor)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Por categoría */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Distribución por categoría
            </h2>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Productos</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">% del total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.por_categoria.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        Sin datos
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.por_categoria.map((c) => {
                      const total = Number.parseFloat(data.kpis.valor_total) || 1;
                      const valor = Number.parseFloat(c.valor) || 0;
                      const pct = (valor / total) * 100;
                      return (
                        <TableRow key={c.categoria}>
                          <TableCell className="font-medium">{c.categoria}</TableCell>
                          <TableCell className="text-right">{c.productos}</TableCell>
                          <TableCell className="text-right">{formatMoney(c.valor)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {pct.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${danger ? "text-rose-600" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
