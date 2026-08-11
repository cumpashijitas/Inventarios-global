import { AlertTriangle, ArrowLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/stores/auth.store";
import { puedeAcceder } from "@/shared/config/roles";
import { inventarioApi, type StockBajoItem } from "@/modules/inventario/services/inventarioApi";

export default function ReporteBajoStockPage() {
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.roles);

  // Solo admin puede ver esta página
  if (!puedeAcceder(roles, "inventario_editar")) {
    navigate("/", { replace: true });
    return null;
  }

  const [items, setItems]       = useState<StockBajoItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtCat, setFiltCat]   = useState("");
  const [filtMarca, setFiltMarca] = useState("");

  useEffect(() => {
    inventarioApi.listStockBajo()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categorias = useMemo(() => [...new Set(items.map(i => i.categoria).filter(Boolean))].sort(), [items]);
  const marcas     = useMemo(() => [...new Set(items.map(i => i.marca).filter(Boolean))].sort(), [items]);

  const filtrados = useMemo(() => items.filter(i => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || i.nombre.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q);
    const matchC = !filtCat   || i.categoria === filtCat;
    const matchM = !filtMarca || i.marca     === filtMarca;
    return matchQ && matchC && matchM;
  }), [items, busqueda, filtCat, filtMarca]);

  const selectCls = "rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white";

  return (
    <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 80px)" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Productos con Stock Bajo</h1>
              <p className="text-xs text-slate-400">Stock actual por debajo del mínimo configurado</p>
            </div>
          </div>
        </div>
        {!loading && (
          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
            {filtrados.length} producto{filtrados.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Panel principal */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Buscar por nombre o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <select className={selectCls} value={filtCat} onChange={e => setFiltCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c!}>{c}</option>)}
          </select>
          <select className={selectCls} value={filtMarca} onChange={e => setFiltMarca(e.target.value)}>
            <option value="">Todas las marcas</option>
            {marcas.map(m => <option key={m} value={m!}>{m}</option>)}
          </select>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <AlertTriangle className="h-10 w-10 mb-3 text-green-300" />
            <p className="text-sm font-medium text-green-600">
              {items.length === 0 ? "¡Todo el inventario tiene stock suficiente!" : "Sin resultados para los filtros aplicados"}
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="border-collapse text-[11px]" style={{ minWidth: "max-content", width: "100%" }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {["#", "CÓDIGO MARCA", "DESCRIPCIÓN", "MARCA", "CATEGORÍA", "PROVEEDOR",
                    "STOCK ACTUAL", "STOCK MÍNIMO", "DIFERENCIA (FALTA)"].map(h => (
                    <th key={h} className="border border-amber-500 bg-amber-400 px-3 py-2 text-center font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item, idx) => {
                  const critico = item.stock_actual === 0;
                  const rowBg = idx % 2 === 0 ? "bg-white" : "bg-amber-50/40";
                  return (
                    <tr key={item.id} className={`${rowBg} hover:bg-amber-100/60`}>
                      <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="border border-slate-200 px-2 py-1.5 font-mono text-indigo-700 font-semibold whitespace-nowrap">{item.sku}</td>
                      <td className="border border-slate-200 px-2 py-1.5 font-semibold text-slate-800 max-w-[220px] truncate">{item.nombre}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-600 whitespace-nowrap">{item.marca ?? "—"}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-600 whitespace-nowrap">{item.categoria ?? "—"}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-500 whitespace-nowrap">{item.proveedor ?? "—"}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center font-mono font-bold">
                        <span className={critico ? "text-red-600" : "text-orange-500"}>
                          {Math.round(item.stock_actual)}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center font-mono text-slate-500">
                        {Math.round(Number(item.stock_minimo))}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          critico ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                        }`}>
                          {critico ? "SIN STOCK" : `−${Math.round(Number(item.diferencia))} uds`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
