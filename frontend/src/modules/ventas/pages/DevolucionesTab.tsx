import {
  ArrowLeftRight, Loader2, Plus, RefreshCw, Search,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { devolucionesApi, MOTIVO_LABELS, type Devolucion } from "@/modules/ventas/services/devolucionesApi";
import { fmtBs } from "@/shared/utils/format";

function DiferenciaBadge({ diferencia }: { diferencia: string }) {
  const d = parseFloat(diferencia);
  if (d > 0)  return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">Cliente paga {fmtBs(d)}</span>;
  if (d < 0)  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Negocio devuelve {fmtBs(Math.abs(d))}</span>;
  return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Cambio exacto</span>;
}

export default function DevolucionesTab() {
  const navigate = useNavigate();
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [busq, setBusq]                 = useState("");

  const devFiltradas = React.useMemo(() => {
    const q = busq.toLowerCase().trim();
    if (!q) return devoluciones;
    return devoluciones.filter(d =>
      (d.venta_numero ?? "").toLowerCase().includes(q) ||
      (d.producto_devuelto_nombre ?? "").toLowerCase().includes(q) ||
      (d.producto_devuelto_sku ?? "").toLowerCase().includes(q) ||
      (d.producto_nuevo_nombre ?? "").toLowerCase().includes(q) ||
      MOTIVO_LABELS[d.motivo]?.toLowerCase().includes(q) ||
      (d.notas ?? "").toLowerCase().includes(q)
    );
  }, [devoluciones, busq]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await devolucionesApi.listar(1, 100);
      setDevoluciones(r.items);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white"
            placeholder="Buscar por venta, producto, motivo o notas…"
            value={busq}
            onChange={e => setBusq(e.target.value)}
          />
        </div>
        <p className="text-sm text-slate-400 shrink-0">
          {devFiltradas.length} de {devoluciones.length}
        </p>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={cargar} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </Button>
          <Button onClick={() => navigate("/ventas/devoluciones/nueva")} className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm">
            <Plus className="h-4 w-4" /> Nueva Devolución
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
        </div>
      ) : devoluciones.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
          <ArrowLeftRight className="h-10 w-10 mb-3" />
          <p className="text-sm">Aún no hay devoluciones registradas</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm border-collapse [&_td]:border [&_td]:border-slate-200">
            <thead className="sticky top-0 z-10">
              <tr>
                {["FECHA", "VENTA ORIGEN", "PRODUCTO DEVUELTO", "CANT.", "REEMBOLSO",
                  "PRODUCTO NUEVO", "COBRADO", "DIFERENCIA", "MOTIVO"].map(h => (
                  <th key={h} className="border border-amber-500 bg-amber-400 px-3 py-2 text-left font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devFiltradas.map((d, idx) => (
                <tr key={d.id} className={idx % 2 === 0 ? "bg-white hover:bg-amber-100/60" : "bg-amber-50/40 hover:bg-amber-100/60"}>
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap font-mono">
                    {new Date(d.created_at).toLocaleDateString("es")}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-indigo-700 whitespace-nowrap">
                    {d.venta_numero ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-800 max-w-[180px] truncate">
                    <p className="font-medium truncate">{d.producto_devuelto_nombre}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{d.producto_devuelto_sku}</p>
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-slate-700">{parseFloat(d.cantidad_devuelta).toFixed(0)}</td>
                  <td className="px-3 py-2 font-mono text-right text-red-600 font-semibold whitespace-nowrap">{fmtBs(d.monto_devuelto)}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate">
                    {d.producto_nuevo_nombre ? (
                      <>
                        <p className="truncate">{d.producto_nuevo_nombre}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{d.producto_nuevo_sku}</p>
                      </>
                    ) : <span className="text-slate-300">— solo reembolso</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-emerald-700 font-semibold whitespace-nowrap">
                    {parseFloat(d.monto_cobrado) > 0 ? fmtBs(d.monto_cobrado) : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap"><DiferenciaBadge diferencia={d.diferencia} /></td>
                  <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">{MOTIVO_LABELS[d.motivo] ?? d.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
