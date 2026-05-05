import { useState } from "react";

import { useAlmacenes } from "@/modules/inventario/hooks/useAlmacenes";
import { useReporteMovimientos } from "@/modules/inventario/hooks/useReportes";
import { Skeleton } from "@/shared/components/Skeleton";
import { Button } from "@/shared/components/ui/button";
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
import { formatDateTime, formatNumber } from "@/shared/lib/format";

const TIPO_COLORS: Record<string, string> = {
  entrada: "bg-emerald-50 text-emerald-700",
  salida: "bg-rose-50 text-rose-700",
  ajuste: "bg-amber-50 text-amber-700",
  transferencia_in: "bg-sky-50 text-sky-700",
  transferencia_out: "bg-indigo-50 text-indigo-700",
};

function defaultDates() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 30);
  return {
    desde: monthAgo.toISOString().slice(0, 10),
    hasta: today.toISOString().slice(0, 10),
  };
}

export default function ReporteMovimientosPage() {
  const { desde: defDesde, hasta: defHasta } = defaultDates();
  const [desde, setDesde] = useState(defDesde);
  const [hasta, setHasta] = useState(defHasta);
  const [tipo, setTipo] = useState("");
  const [almacenId, setAlmacenId] = useState("");
  const [page, setPage] = useState(1);

  const { data: almacenes = [] } = useAlmacenes();
  const { data, isLoading } = useReporteMovimientos({
    desde,
    hasta,
    tipo: tipo || undefined,
    almacen_id: almacenId || undefined,
    page,
    page_size: 50,
  });

  const reset = () => {
    setDesde(defDesde);
    setHasta(defHasta);
    setTipo("");
    setAlmacenId("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporte de movimientos</h1>
        <p className="text-sm text-muted-foreground">
          Historial detallado de entradas, salidas, ajustes y transferencias.
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="desde">Desde</Label>
            <Input
              id="desde"
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hasta">Hasta</Label>
            <Input
              id="hasta"
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setPage(1);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
              <option value="transferencia_in">Transferencia entrada</option>
              <option value="transferencia_out">Transferencia salida</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="almacen">Almacén</Label>
            <select
              id="almacen"
              value={almacenId}
              onChange={(e) => {
                setAlmacenId(e.target.value);
                setPage(1);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} — {a.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={reset}>
            Limpiar
          </Button>
        </div>
      </div>

      {/* Resumen */}
      {data && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Entradas" value={data.resumen.entradas.toString()} />
          <Kpi label="Salidas" value={data.resumen.salidas.toString()} />
          <Kpi label="Ajustes" value={data.resumen.ajustes.toString()} />
          <Kpi label="Transferencias" value={data.resumen.transferencias.toString()} />
          <Kpi label="Unid. entrada" value={formatNumber(data.resumen.unidades_entrada)} />
          <Kpi label="Unid. salida" value={formatNumber(data.resumen.unidades_salida)} />
        </div>
      )}

      {/* Tabla */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No hay movimientos para los filtros seleccionados.
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Costo unit.</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(m.created_at)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          TIPO_COLORS[m.tipo] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {m.tipo}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                    <TableCell className="font-medium">{m.producto_nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.almacen_codigo}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(m.cantidad)}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(m.costo_unitario)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.motivo ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {data.items.length} de {data.total} · página {data.page} de {data.total_pages}
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
