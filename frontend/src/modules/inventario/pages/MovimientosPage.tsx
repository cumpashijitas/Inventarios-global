import { useMovimientos } from "@/modules/inventario/hooks/useStock";
import { EmptyState } from "@/shared/components/EmptyState";
import { Skeleton } from "@/shared/components/Skeleton";
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

export default function MovimientosPage() {
  const { data, isLoading } = useMovimientos({ limit: 100 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <p className="text-sm text-muted-foreground">
          Últimos 100 movimientos de stock. El kardex completo por producto se accede
          desde la ficha del producto.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Sin movimientos aún"
          description="Cuando ajustes stock o registres entradas/salidas, aparecerán aquí."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => (
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
                  <TableCell className="text-right font-medium">
                    {formatNumber(m.cantidad)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(m.costo_unitario)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.motivo ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
