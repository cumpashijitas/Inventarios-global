import { Search, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@/shared/components/ui/card";
import { reportesApi } from "@/modules/reportes/services/reportesApi";
import type { ReporteVentas } from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";

const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export default function ReporteVentasPage() {
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy);
  const [busqueda, setBusqueda] = useState("");
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setReporte(await reportesApi.getVentas(desde, hasta, busqueda.trim() || undefined));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [desde, hasta, busqueda]);

  const top = reporte?.top_productos ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reporte de Ventas</h1>
        <p className="text-sm text-slate-500">Ranking de productos más vendidos por período</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <label className="text-xs font-semibold text-slate-600">Buscar producto</label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Nombre o código…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>
      </div>

      {/* Resumen del período */}
      {reporte && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="px-3 py-2">
              <p className="text-xs text-slate-500">Ingresos totales</p>
              <p className="text-lg font-bold text-slate-800">{fmtBs(reporte.resumen.ingresos_totales)}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="px-3 py-2">
              <p className="text-xs text-slate-500">Ganancia bruta</p>
              <p className="text-lg font-bold text-emerald-600">{fmtBs(reporte.resumen.ganancia_bruta)}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="px-3 py-2">
              <p className="text-xs text-slate-500">Transacciones</p>
              <p className="text-lg font-bold text-slate-800">{reporte.resumen.transacciones}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="px-3 py-2">
              <p className="text-xs text-slate-500">Ticket promedio</p>
              <p className="text-lg font-bold text-slate-800">{fmtBs(reporte.resumen.ticket_promedio)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ranking de productos */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <TrendingUp className="h-4 w-4 text-indigo-600" />
          <p className="text-sm font-semibold text-slate-700">
            {busqueda ? `Más vendidos para "${busqueda}"` : "Productos más vendidos"}
          </p>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Cargando…</div>
        ) : top.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            {busqueda ? `Sin ventas para "${busqueda}" en este período.` : "Sin ventas en este período."}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="text-left py-2 px-5 font-semibold">#</th>
                <th className="text-left py-2 px-3 font-semibold">Código</th>
                <th className="text-left py-2 px-3 font-semibold">Producto</th>
                <th className="text-right py-2 px-3 font-semibold">Cantidad vendida</th>
                <th className="text-right py-2 px-5 font-semibold">Total vendido</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p, i) => (
                <tr key={p.sku} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                  <td className="py-2 px-5 text-slate-400">{i + 1}</td>
                  <td className="py-2 px-3 font-mono text-indigo-700">{p.sku}</td>
                  <td className="py-2 px-3 text-slate-700">{p.nombre}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-600">{Number(p.cantidad_vendida).toFixed(0)}</td>
                  <td className="py-2 px-5 text-right tabular-nums font-semibold text-slate-800">{fmtBs(p.total_vendido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
