import {
  AlertTriangle, ArrowLeftRight, CheckCircle, ChevronRight,
  Loader2, Package, Plus, RefreshCw, Search, X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ventasApi } from "@/modules/ventas/services/ventasApi";
import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import { devolucionesApi, MOTIVO_LABELS, type Devolucion, type DevolucionIn } from "@/modules/ventas/services/devolucionesApi";
import { fmtBs } from "@/shared/utils/format";
import type { Producto, Venta, VentaItem } from "@/shared/types/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function DiferenciaBadge({ diferencia }: { diferencia: string }) {
  const d = parseFloat(diferencia);
  if (d > 0)  return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">Cliente paga {fmtBs(d)}</span>;
  if (d < 0)  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Negocio devuelve {fmtBs(Math.abs(d))}</span>;
  return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Cambio exacto</span>;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DevolucionesTab() {
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(false);
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
      {/* Toolbar */}
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
          <Button onClick={() => setModal(true)} className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm">
            <Plus className="h-4 w-4" /> Nueva Devolución
          </Button>
        </div>
      </div>

      {/* Lista */}
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

      {/* Modal nueva devolución */}
      {modal && (
        <NuevaDevolucionModal
          onClose={() => setModal(false)}
          onSuccess={() => { setModal(false); cargar(); }}
        />
      )}
    </div>
  );
}

// ─── Modal nueva devolución ───────────────────────────────────────────────────
function NuevaDevolucionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  // ── Estado del wizard ─────────────────────────────────────────────────────
  const [paso, setPaso]     = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Paso 1: búsqueda de venta
  const [busqVenta, setBusqVenta]   = useState("");
  const [ventasBusc, setVentasBusc] = useState<Venta[]>([]);
  const [buscando, setBuscando]     = useState(false);
  const [ventaSel, setVentaSel]     = useState<Venta | null>(null);
  const [cargandoVenta, setCargandoVenta] = useState(false);

  // Paso 2: selección de ítem y motivo
  const [itemSel, setItemSel]     = useState<VentaItem | null>(null);
  const [cantDev, setCantDev]     = useState(1);
  const [motivo, setMotivo]       = useState<DevolucionIn["motivo"]>("defecto_fabrica");
  const [notas, setNotas]         = useState("");
  const [conCambio, setConCambio] = useState(false);

  // Paso 2b: producto nuevo (si hay cambio)
  const [busqProd, setBusqProd]         = useState("");
  const [todosProds, setTodosProds]     = useState<Producto[]>([]);
  const [cargandoProds, setCargandoProds] = useState(false);
  const [prodNuevo, setProdNuevo]       = useState<Producto | null>(null);
  const [cantNueva, setCantNueva]       = useState(1);

  // Filtro cliente de productos
  const prodsFiltrados = React.useMemo(() => {
    const q = busqProd.toLowerCase().trim();
    if (!q) return todosProds;
    return todosProds.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.marca ?? "").toLowerCase().includes(q) ||
      (p.modelos ?? "").toLowerCase().includes(q)
    );
  }, [todosProds, busqProd]);

  // ── Cargar ventas recientes al abrir ──────────────────────────────────────
  useEffect(() => {
    setBuscando(true);
    ventasApi.listVentas({ page_size: 20, estado: "completada" })
      .then(r => setVentasBusc(r.items))
      .catch(() => {})
      .finally(() => setBuscando(false));
  }, []);

  // ── Búsqueda dinámica con debounce ────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscando(true);
      ventasApi.listVentas({ search: busqVenta || undefined, page_size: 20, estado: "completada" })
        .then(r => setVentasBusc(r.items))
        .catch(() => {})
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [busqVenta]);

  // ── Seleccionar venta → cargar detalles completos con items ───────────────
  const seleccionarVenta = async (v: Venta) => {
    setCargandoVenta(true);
    try {
      const completa = await ventasApi.getVenta(v.id);
      setVentaSel(completa);
      setItemSel(null);
      setCantDev(1);
      setPaso(2);
    } catch { setError("No se pudo cargar el detalle de la venta."); }
    finally { setCargandoVenta(false); }
  };

  // ── Cargar todos los productos cuando se activa el cambio ────────────────
  const cargarProductos = async () => {
    if (todosProds.length > 0) return; // ya cargados
    setCargandoProds(true);
    try {
      const r = await inventarioApi.listProductos({ page_size: 200, only_active: true });
      setTodosProds(r.items);
    } catch { }
    finally { setCargandoProds(false); }
  };

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const montoDevuelto = itemSel
    ? parseFloat(itemSel.precio_unitario) * (1 - parseFloat(itemSel.descuento_pct ?? "0") / 100) * cantDev
    : 0;

  const montoCobrado = (conCambio && prodNuevo)
    ? parseFloat(prodNuevo.precio_venta) * cantNueva
    : 0;

  const diferencia = montoCobrado - montoDevuelto;

  // ── Confirmar ─────────────────────────────────────────────────────────────
  const confirmar = async () => {
    if (!ventaSel || !itemSel) return;
    setSaving(true);
    setError(null);
    try {
      const body: DevolucionIn = {
        venta_id:             ventaSel.id,
        venta_item_id:        itemSel.id,
        producto_devuelto_id: itemSel.producto_id,
        cantidad_devuelta:    cantDev,
        motivo,
        notas:               notas || undefined,
        producto_nuevo_id:   conCambio && prodNuevo ? prodNuevo.id : undefined,
        cantidad_nueva:      conCambio && prodNuevo ? cantNueva : undefined,
      };
      await devolucionesApi.crear(body);
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Error al registrar la devolución";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
              <ArrowLeftRight className="h-5 w-5 text-rose-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold">Nueva Devolución / Cambio</DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                {paso === 1 ? "Paso 1 — Selecciona la venta de origen" : paso === 2 ? "Paso 2 — Selecciona el producto y completa los detalles" : "Paso 3 — Revisa y confirma"}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 mt-3">
            {[1, 2, 3].map(p => (
              <div key={p} className={`h-1.5 flex-1 rounded-full transition-colors ${p <= paso ? "bg-rose-500" : "bg-slate-200"}`} />
            ))}
          </div>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 mt-1">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PASO 1: Buscar y seleccionar venta
        ══════════════════════════════════════════════════════════════════ */}
        {paso === 1 && (
          <div className="space-y-3 py-2">
            {/* Buscador dinámico */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />}
              <input
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white"
                placeholder="Buscar por número de venta, nombre del cliente…"
                value={busqVenta}
                onChange={e => setBusqVenta(e.target.value)}
              />
            </div>

            {/* Encabezado de lista */}
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              {busqVenta ? `Resultados para "${busqVenta}"` : "Ventas recientes"}
            </p>

            {/* Lista de ventas */}
            <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {buscando && ventasBusc.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-slate-300">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : ventasBusc.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  No se encontraron ventas
                </div>
              ) : ventasBusc.map(v => (
                <button
                  key={v.id}
                  disabled={cargandoVenta}
                  onClick={() => seleccionarVenta(v)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-rose-50 transition-colors group"
                >
                  {/* Ícono */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors">
                    <Package className="h-5 w-5" />
                  </div>
                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-800">{v.numero}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.estado === "completada" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {v.estado}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {v.cliente_nombre ?? "Cliente general"}
                      {v.vendedor_nombre ? ` · Vendido por ${v.vendedor_nombre}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(v.fecha).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
                      {" · "}{v.metodo_pago.replace(/_/g, " ")}
                    </p>
                  </div>
                  {/* Total */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-800 text-base">{fmtBs(v.total)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {(v.items?.length ?? 0)} producto{(v.items?.length ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 group-hover:text-rose-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PASO 2: Seleccionar ítem + detalles
        ══════════════════════════════════════════════════════════════════ */}
        {paso === 2 && ventaSel && (
          <div className="space-y-4 py-2">

            {/* Banner venta seleccionada */}
            <div className="flex items-center gap-3 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Package className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold text-indigo-800 text-sm">{ventaSel.numero}</p>
                <p className="text-xs text-indigo-600 truncate">
                  {ventaSel.cliente_nombre ?? "Cliente general"} ·{" "}
                  {new Date(ventaSel.fecha).toLocaleDateString("es")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-indigo-800">{fmtBs(ventaSel.total)}</p>
                <p className="text-[10px] text-indigo-500">{ventaSel.metodo_pago.replace(/_/g, " ")}</p>
              </div>
            </div>

            {/* ─ Productos de la venta ─ */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Selecciona el producto que devuelven
              </p>
              {ventaSel.items.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Esta venta no tiene productos registrados</p>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                  {ventaSel.items.map(item => {
                    const seleccionado = itemSel?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setItemSel(item); setCantDev(1); setConCambio(false); setProdNuevo(null); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
                          seleccionado
                            ? "bg-rose-50 border-l-[3px] border-l-rose-500"
                            : "hover:bg-slate-50 border-l-[3px] border-l-transparent"
                        }`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${seleccionado ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                          {parseFloat(item.cantidad).toFixed(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${seleccionado ? "text-rose-800" : "text-slate-800"}`}>{item.nombre}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {item.sku}
                            {parseFloat(item.descuento_pct) > 0 && ` · ${item.descuento_pct}% dto.`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-700">{fmtBs(item.precio_unitario)} <span className="text-xs font-normal text-slate-400">c/u</span></p>
                          <p className="text-xs text-slate-500 mt-0.5">Total: {fmtBs(item.subtotal)}</p>
                        </div>
                        {seleccionado
                          ? <CheckCircle className="h-5 w-5 text-rose-500 shrink-0" />
                          : <div className="h-5 w-5 rounded-full border-2 border-slate-200 shrink-0" />
                        }
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─ Detalles del item seleccionado ─ */}
            {itemSel && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalles de la devolución</p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Cantidad */}
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">
                      Cantidad a devolver
                      <span className="ml-1 font-normal text-slate-400">(máx. {parseFloat(itemSel.cantidad).toFixed(0)})</span>
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => setCantDev(v => Math.max(1, v - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      >−</button>
                      <Input
                        type="number" min={1} max={parseFloat(itemSel.cantidad)} step={1}
                        className="w-16 text-center"
                        value={cantDev}
                        onChange={e => setCantDev(Math.min(parseFloat(itemSel.cantidad), Math.max(1, parseInt(e.target.value) || 1)))}
                      />
                      <button
                        onClick={() => setCantDev(v => Math.min(parseFloat(itemSel.cantidad), v + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      >+</button>
                      <span className="text-xs text-slate-400">de {parseFloat(itemSel.cantidad).toFixed(0)} uds</span>
                    </div>
                    {/* Preview monto */}
                    <p className="text-xs text-rose-600 font-semibold mt-1.5">
                      Reembolso: {fmtBs(parseFloat(itemSel.precio_unitario) * (1 - parseFloat(itemSel.descuento_pct ?? "0") / 100) * cantDev)}
                    </p>
                  </div>

                  {/* Motivo */}
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Motivo</Label>
                    <select className={inputCls} value={motivo} onChange={e => setMotivo(e.target.value as DevolucionIn["motivo"])}>
                      {Object.entries(MOTIVO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>

                  {/* Notas */}
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-slate-600">Notas <span className="font-normal text-slate-400">(opcional)</span></Label>
                    <textarea
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
                      rows={2}
                      placeholder="Descripción del problema, estado del producto…"
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                    />
                  </div>
                </div>

                {/* Toggle cambio de producto */}
                <div>
                  <button
                    onClick={() => {
                      const nuevo = !conCambio;
                      setConCambio(nuevo);
                      setProdNuevo(null);
                      setBusqProd("");
                      if (nuevo) cargarProductos();
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${
                      conCambio ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${conCambio ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                      <ArrowLeftRight className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-semibold ${conCambio ? "text-emerald-800" : "text-slate-700"}`}>
                        {conCambio ? "Cambio de producto activado" : "¿El cliente se lleva otro producto a cambio?"}
                      </p>
                      <p className="text-xs text-slate-400">{conCambio ? "Selecciona el producto que se lleva" : "Si no, se hace reembolso en efectivo"}</p>
                    </div>
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${conCambio ? "bg-emerald-500" : "bg-slate-200"}`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow ${conCambio ? "translate-x-6" : "translate-x-1"}`} />
                    </div>
                  </button>

                  {/* ── Catálogo de productos (estilo ventas) ── */}
                  {conCambio && (
                    <div className="mt-3 rounded-xl border border-emerald-200 overflow-hidden">
                      {/* Producto seleccionado + cantidad (si ya eligió) */}
                      {prodNuevo && (
                        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-emerald-800 truncate">{prodNuevo.nombre}</p>
                            <p className="text-[11px] font-mono text-emerald-600">{prodNuevo.sku} · {fmtBs(prodNuevo.precio_venta)} c/u</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => setCantNueva(v => Math.max(1, v - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-300 bg-white text-emerald-600 hover:bg-emerald-100 font-bold">−</button>
                            <span className="w-8 text-center text-sm font-bold text-emerald-800">{cantNueva}</span>
                            <button onClick={() => setCantNueva(v => v + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-300 bg-white text-emerald-600 hover:bg-emerald-100 font-bold">+</button>
                            <span className="text-xs text-emerald-600 font-semibold ml-1">{fmtBs(parseFloat(prodNuevo.precio_venta) * cantNueva)}</span>
                          </div>
                          <button onClick={() => { setProdNuevo(null); setBusqProd(""); }} className="text-slate-300 hover:text-red-400 ml-1">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* Buscador */}
                      <div className="relative border-b border-slate-200">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        {cargandoProds && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />}
                        <input
                          autoFocus
                          className="w-full bg-white py-2.5 pl-9 pr-9 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-0"
                          placeholder="Buscar por nombre, SKU, marca o modelo…"
                          value={busqProd}
                          onChange={e => setBusqProd(e.target.value)}
                        />
                        {busqProd && (
                          <button type="button" onClick={() => setBusqProd("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Lista de productos */}
                      <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto bg-white">
                        {cargandoProds ? (
                          <div className="flex items-center justify-center py-8 text-slate-300">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : prodsFiltrados.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                            <Search className="h-7 w-7 mb-1" />
                            <p className="text-xs">{busqProd ? `Sin resultados para "${busqProd}"` : "No hay productos"}</p>
                          </div>
                        ) : prodsFiltrados.map(p => {
                          const stock = Math.round(Number(p.stock_total ?? 0));
                          const sel   = prodNuevo?.id === p.id;
                          const stockColor = stock === 0 ? "text-red-500" : stock < 5 ? "text-orange-500" : "text-emerald-600";
                          return (
                            <button
                              key={p.id}
                              onClick={() => { setProdNuevo(p); setCantNueva(1); setBusqProd(""); }}
                              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${sel ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                            >
                              {/* Avatar */}
                              {p.imagen_url ? (
                                <img src={p.imagen_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover border border-slate-100" />
                              ) : (
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-base font-bold text-slate-400">
                                  {p.nombre[0]?.toUpperCase()}
                                </div>
                              )}
                              {/* Datos */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate leading-snug">{p.nombre}</p>
                                <p className="text-[11px] text-indigo-500 font-medium mt-0.5 truncate">
                                  {p.sku}{p.marca ? ` · ${p.marca}` : ""}{p.modelos ? ` · ${p.modelos}` : ""}
                                </p>
                                {p.medidas && <p className="text-[10px] text-slate-400 mt-0.5">{p.medidas}</p>}
                              </div>
                              {/* Precio + stock */}
                              <div className="text-right shrink-0 ml-2">
                                <p className="text-base font-bold text-slate-800">{fmtBs(p.precio_venta)}</p>
                                <p className={`text-[11px] font-semibold mt-0.5 ${stockColor}`}>
                                  {stock === 0 ? "Sin stock" : `Stock: ${stock}`}
                                </p>
                              </div>
                              {sel && <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PASO 3: Resumen y confirmación
        ══════════════════════════════════════════════════════════════════ */}
        {paso === 3 && ventaSel && itemSel && (
          <div className="space-y-4 py-2">
            {/* Resumen visual */}
            <div className="grid grid-cols-2 gap-3">
              {/* Producto que entra */}
              <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2">← Entra al almacén</p>
                <p className="text-sm font-semibold text-red-800 leading-tight">{itemSel.nombre}</p>
                <p className="text-xs text-red-500 font-mono mt-0.5">{itemSel.sku}</p>
                <p className="text-lg font-bold text-red-700 mt-2">{cantDev} ud{cantDev !== 1 ? "s" : ""}</p>
                <p className="text-xs text-red-600 mt-0.5">Reembolso: <strong>{fmtBs(montoDevuelto)}</strong></p>
              </div>

              {/* Producto que sale (si hay cambio) */}
              {conCambio && prodNuevo ? (
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">→ Sale del almacén</p>
                  <p className="text-sm font-semibold text-emerald-800 leading-tight">{prodNuevo.nombre}</p>
                  <p className="text-xs text-emerald-500 font-mono mt-0.5">{prodNuevo.sku}</p>
                  <p className="text-lg font-bold text-emerald-700 mt-2">{cantNueva} ud{cantNueva !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">A cobrar: <strong>{fmtBs(montoCobrado)}</strong></p>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 flex flex-col items-center justify-center text-center">
                  <p className="text-xs text-slate-400 font-semibold">Solo reembolso</p>
                  <p className="text-[10px] text-slate-300 mt-1">No se lleva producto a cambio</p>
                </div>
              )}
            </div>

            {/* Diferencia final — el resultado clave */}
            <div className={`rounded-xl border-2 p-4 ${
              diferencia > 0 ? "border-orange-300 bg-orange-50" :
              diferencia < 0 ? "border-red-300 bg-red-50" :
              "border-green-300 bg-green-50"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Resultado en caja</p>
                  {diferencia > 0 && <p className="text-sm text-orange-700 font-semibold mt-1">El cliente paga la diferencia</p>}
                  {diferencia < 0 && <p className="text-sm text-red-700 font-semibold mt-1">La tienda devuelve dinero al cliente</p>}
                  {diferencia === 0 && <p className="text-sm text-green-700 font-semibold mt-1">Cambio exacto — sin movimiento de caja</p>}
                </div>
                <DiferenciaBadge diferencia={String(diferencia)} />
              </div>
            </div>

            {/* Detalles secundarios */}
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-slate-400 w-28 shrink-0">Venta origen</span>
                <span className="font-mono font-semibold text-indigo-700">{ventaSel.numero}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-slate-400 w-28 shrink-0">Motivo</span>
                <span className="text-slate-700">{MOTIVO_LABELS[motivo]}</span>
              </div>
              {notas && (
                <div className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-xs text-slate-400 w-28 shrink-0 mt-0.5">Notas</span>
                  <span className="text-slate-600 text-xs">{notas}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          {paso > 1 && (
            <Button variant="outline" onClick={() => { setPaso(p => (p - 1) as 1 | 2 | 3); setError(null); }}>
              ← Atrás
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {paso < 3 ? (
            <Button
              disabled={
                paso === 1 ? !ventaSel :
                !itemSel || (conCambio && !prodNuevo)
              }
              onClick={() => setPaso(p => (p + 1) as 2 | 3)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Siguiente →
            </Button>
          ) : (
            <Button
              onClick={confirmar}
              disabled={saving}
              className="bg-rose-600 hover:bg-rose-700 text-white min-w-[130px]"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Registrando…</> : <><CheckCircle className="h-4 w-4 mr-1" /> Confirmar Devolución</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
