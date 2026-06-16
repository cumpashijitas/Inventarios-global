import {
  AlertTriangle, ArrowLeft, ArrowLeftRight, CheckCircle,
  ImageIcon, Loader2, Search, X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import { ventasApi } from "@/modules/ventas/services/ventasApi";
import { devolucionesApi, MOTIVO_LABELS, type DevolucionIn } from "@/modules/ventas/services/devolucionesApi";
import type { Producto, Venta, VentaItem } from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";

interface ReturnRow {
  item: VentaItem;
  checked: boolean;
  cantidad: number;
}

export default function NuevaDevoluccionPage() {
  const navigate = useNavigate();

  // ── Búsqueda de venta ────────────────────────────────────────────────────
  const [busqueda,      setBusqueda]      = useState("");
  const [ventas,        setVentas]        = useState<Venta[]>([]);
  const [buscando,      setBuscando]      = useState(false);
  const [dropOpen,      setDropOpen]      = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Venta + items ────────────────────────────────────────────────────────
  const [ventaSel,      setVentaSel]      = useState<Venta | null>(null);
  const [cargandoItems, setCargandoItems] = useState(false);
  const [seleccion,     setSeleccion]     = useState<ReturnRow[]>([]);

  // ── Producto de reemplazo ────────────────────────────────────────────────
  const [conCambio,   setConCambio]   = useState(false);
  const [busqProd,    setBusqProd]    = useState("");
  const [prods,       setProds]       = useState<Producto[]>([]);
  const [cargandoP,   setCargandoP]   = useState(false);
  const [prodNuevo,   setProdNuevo]   = useState<Producto | null>(null);
  const [cantNueva,   setCantNueva]   = useState(1);

  // Anchos columnas sticky — tabla de reemplazo (igual que inventario)
  const [skuW,  setSkuW]  = useState(130);
  const [univW, setUnivW] = useState(110);
  const [descW, setDescW] = useState(200);
  const resizingRef = useRef<{ startX: number; startW: number } | null>(null);
  const makeResize = (cur: number, set: (w: number) => void) =>
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = { startX: e.clientX, startW: cur };
      const onMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        set(Math.max(60, resizingRef.current.startW + (ev.clientX - resizingRef.current.startX)));
      };
      const onUp = () => {
        resizingRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

  // ── Formulario ───────────────────────────────────────────────────────────
  const [motivo,  setMotivo]  = useState<DevolucionIn["motivo"]>("defecto_fabrica");
  const [notas,   setNotas]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [ok,      setOk]      = useState(false);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Ventas recientes al entrar
  useEffect(() => {
    setBuscando(true);
    ventasApi.listVentas({ page_size: 20, estado: "completada" })
      .then(r => setVentas(r.items)).catch(() => {}).finally(() => setBuscando(false));
  }, []);

  // Búsqueda de venta con debounce
  useEffect(() => {
    if (!busqueda.trim()) return;
    const t = setTimeout(() => {
      setBuscando(true);
      ventasApi.listVentas({ search: busqueda.trim(), page_size: 20, estado: "completada" })
        .then(r => { setVentas(r.items); setDropOpen(true); })
        .catch(() => {}).finally(() => setBuscando(false));
    }, 200);
    return () => clearTimeout(t);
  }, [busqueda]);

  const seleccionarVenta = async (v: Venta) => {
    setDropOpen(false);
    setBusqueda(`${v.numero}  —  ${v.cliente_nombre ?? "Cliente general"}`);
    setError(null); setConCambio(false); setProdNuevo(null); setBusqProd("");
    if (v.items && v.items.length > 0) {
      setVentaSel(v);
      setSeleccion(v.items.map(it => ({ item: it, checked: false, cantidad: parseFloat(it.cantidad) })));
      return;
    }
    setCargandoItems(true); setVentaSel(null); setSeleccion([]);
    try {
      const full = await ventasApi.getVenta(v.id);
      setVentaSel(full);
      setSeleccion(full.items.map(it => ({ item: it, checked: false, cantidad: parseFloat(it.cantidad) })));
    } catch { setError("No se pudo cargar los productos de esta venta."); }
    finally { setCargandoItems(false); }
  };

  const toggleCheck = (idx: number) =>
    setSeleccion(p => p.map((r, i) => i !== idx ? r : { ...r, checked: !r.checked }));

  const setCant = (idx: number, val: number) =>
    setSeleccion(p => p.map((r, i) => i !== idx ? r : {
      ...r, cantidad: Math.min(parseFloat(r.item.cantidad), Math.max(1, Math.round(val) || 1))
    }));

  // Búsqueda de productos por API con debounce — igual que NuevaVentaPage
  // Se activa cuando conCambio=true (carga inicial) y en cada cambio de busqProd
  useEffect(() => {
    if (!conCambio) return;
    setCargandoP(true);
    const t = setTimeout(() => {
      inventarioApi.listProductos({
        search: busqProd.trim() || undefined,
        only_active: true,
        page_size: busqProd.trim() ? 150 : 60,
      })
        .then(r => setProds(r.items))
        .catch(() => {})
        .finally(() => setCargandoP(false));
    }, 300);
    return () => clearTimeout(t);
  }, [busqProd, conCambio]);

  // Cálculos reactivos
  const seleccionados = seleccion.filter(r => r.checked);
  const montoDevuelto = seleccionados.reduce((s, r) => {
    const precio = parseFloat(r.item.precio_unitario);
    const desc   = parseFloat(r.item.descuento_pct ?? "0") / 100;
    return s + precio * (1 - desc) * r.cantidad;
  }, 0);
  const montoCobrado = conCambio && prodNuevo ? parseFloat(prodNuevo.precio_venta) * cantNueva : 0;
  const diferencia   = montoCobrado - montoDevuelto;

  // Confirmar: N llamadas en paralelo
  const confirmar = async () => {
    if (!ventaSel || seleccionados.length === 0 || saving) return;
    setSaving(true); setError(null);
    try {
      await Promise.all(
        seleccionados.map((r, i) =>
          devolucionesApi.crear({
            venta_id:             ventaSel.id,
            venta_item_id:        r.item.id,
            producto_devuelto_id: r.item.producto_id!,
            cantidad_devuelta:    r.cantidad,
            motivo,
            notas:               notas || undefined,
            producto_nuevo_id:   conCambio && prodNuevo && i === 0 ? prodNuevo.id : undefined,
            cantidad_nueva:      conCambio && prodNuevo && i === 0 ? cantNueva    : undefined,
          })
        )
      );
      setOk(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Error al registrar la devolución.");
    } finally { setSaving(false); }
  };

  if (ok) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">✓</div>
        <h2 className="text-2xl font-bold text-slate-800">¡Devolución registrada!</h2>
        <p className="text-sm text-slate-400">
          {seleccionados.length} producto{seleccionados.length !== 1 ? "s" : ""} procesado{seleccionados.length !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => {
            setOk(false); setVentaSel(null); setSeleccion([]); setBusqueda("");
            setConCambio(false); setProdNuevo(null); setNotas(""); setError(null);
          }}>Nueva devolución</Button>
          <Button onClick={() => navigate("/ventas")} className="bg-slate-800 hover:bg-slate-900 text-white">
            Ver historial
          </Button>
        </div>
      </div>
    );
  }

  // Constantes de tabla — idénticas a NuevaVentaPage
  const W_FOTO = 50;
  const L_SKU  = W_FOTO;
  const L_UNIV = W_FOTO + skuW;
  const L_DESC = W_FOTO + skuW + univW;
  const TH_BASE = "border border-amber-500 bg-amber-400 px-1 py-1 font-bold text-black uppercase text-[10px] text-center leading-tight";
  const TH_S    = `${TH_BASE} sticky z-40`;

  return (
    <div className="flex flex-col min-h-full bg-white">

      {/* ── Header sticky ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 shrink-0 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
        <button type="button" onClick={() => navigate("/ventas")}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 shrink-0">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="h-5 w-px bg-slate-200 shrink-0" />
        <ArrowLeftRight className="h-4 w-4 text-rose-600 shrink-0" />
        <span className="font-semibold text-slate-800 text-sm shrink-0">Nueva Devolución</span>

        {/* Autocomplete venta */}
        <div ref={searchRef} className="relative flex-1 max-w-lg">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
          {buscando && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-300 z-10" />}
          <input autoFocus
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white"
            placeholder="Buscar venta por número o nombre del cliente…"
            value={busqueda}
            onChange={e => {
              setBusqueda(e.target.value); setDropOpen(true);
              if (!e.target.value.trim()) { setVentaSel(null); setSeleccion([]); }
            }}
            onFocus={() => setDropOpen(true)}
          />
          {busqueda && (
            <button type="button"
              onClick={() => { setBusqueda(""); setVentaSel(null); setSeleccion([]); setDropOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10">
              <X className="h-3 w-3" />
            </button>
          )}
          {dropOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
              {ventas.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-400 text-center">{buscando ? "Buscando…" : "Sin ventas encontradas"}</p>
              ) : ventas.map(v => (
                <button key={v.id} type="button" onClick={() => seleccionarVenta(v)}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left hover:bg-rose-50 last:border-0">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-sm text-indigo-700">{v.numero}</span>
                    <span className="ml-2 text-xs text-slate-600">{v.cliente_nombre ?? "Cliente general"}</span>
                    <span className="ml-2 text-xs text-slate-400">{new Date(v.fecha).toLocaleDateString("es")}</span>
                  </div>
                  <span className="font-mono font-semibold text-slate-700 shrink-0">{fmtBs(v.total)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-5 max-w-5xl mx-auto w-full space-y-4">

        {!ventaSel && !cargandoItems && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <ArrowLeftRight className="h-14 w-14 mb-4" />
            <p className="text-base">Busca una venta arriba para ver sus productos</p>
          </div>
        )}

        {cargandoItems && (
          <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando productos…
          </div>
        )}

        {ventaSel && !cargandoItems && (
          <>
            {/* Banner venta */}
            <div className="flex items-center gap-4 flex-wrap rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm">
              <span className="font-mono font-bold text-indigo-700 text-base">{ventaSel.numero}</span>
              <span className="text-indigo-600 font-medium">{ventaSel.cliente_nombre ?? "Cliente general"}</span>
              <span className="text-indigo-400">{new Date(ventaSel.fecha).toLocaleDateString("es")}</span>
              <span className="ml-auto font-mono font-bold text-indigo-700 text-base">{fmtBs(ventaSel.total)}</span>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <p className="text-xs text-slate-400">Marca los productos que el cliente devuelve y ajusta la cantidad si es necesario.</p>

            {/* ── Tabla de productos de la venta ──────────────────────── */}
            <div className="overflow-auto rounded-lg border border-amber-300">
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className={`${TH_BASE} w-8`}>✓</th>
                    <th className={`${TH_BASE} w-10`}>FOTO</th>
                    <th className={`${TH_BASE} text-left pl-2`}>CÓDIGO</th>
                    <th className={`${TH_BASE} text-left pl-2 min-w-[200px]`}>DESCRIPCIÓN</th>
                    <th className={TH_BASE}>VENDIDO</th>
                    <th className={TH_BASE}>A DEVOLVER</th>
                    <th className={TH_BASE}>PRECIO U.</th>
                    <th className={TH_BASE}>REEMBOLSO</th>
                  </tr>
                </thead>
                <tbody>
                  {seleccion.map((r, idx) => {
                    const precio    = parseFloat(r.item.precio_unitario);
                    const desc      = parseFloat(r.item.descuento_pct ?? "0") / 100;
                    const reembolso = precio * (1 - desc) * r.cantidad;
                    const bg        = r.checked ? "#fce7f3" : idx % 2 === 0 ? "#ffffff" : "#fffbeb";
                    return (
                      <tr key={r.item.id} onClick={() => toggleCheck(idx)}
                        className="cursor-pointer hover:brightness-95 transition-colors"
                        style={{ backgroundColor: bg }}>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          <div className={`mx-auto w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${r.checked ? "bg-rose-500 border-rose-500" : "border-slate-300 bg-white"}`}>
                            {r.checked && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5 8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        </td>
                        <td className="border border-slate-200 px-1 py-1.5">
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center mx-auto">
                            <ImageIcon className="h-3.5 w-3.5 text-slate-300" />
                          </div>
                        </td>
                        <td className="border border-slate-200 px-2 py-2 font-mono text-indigo-700 font-semibold whitespace-nowrap" onClick={e => e.stopPropagation()}>{r.item.sku}</td>
                        <td className="border border-slate-200 px-2 py-2 max-w-[280px]" onClick={e => e.stopPropagation()}>
                          <span className={`block truncate font-medium ${r.checked ? "text-rose-800" : "text-slate-800"}`}>{r.item.nombre}</span>
                          {parseFloat(r.item.descuento_pct) > 0 && <span className="text-[9px] text-slate-400">{r.item.descuento_pct}% dto.</span>}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center font-mono text-slate-500">{parseFloat(r.item.cantidad).toFixed(0)}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                          {r.checked ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={e => { e.stopPropagation(); setCant(idx, r.cantidad - 1); }} className="w-5 h-5 rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold flex items-center justify-center leading-none">−</button>
                              <span className="w-6 text-center font-bold text-rose-700">{r.cantidad}</span>
                              <button onClick={e => { e.stopPropagation(); setCant(idx, r.cantidad + 1); }} className="w-5 h-5 rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold flex items-center justify-center leading-none">+</button>
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-right font-mono text-slate-500 whitespace-nowrap" onClick={e => e.stopPropagation()}>{fmtBs(r.item.precio_unitario)}</td>
                        <td className={`border border-slate-200 px-2 py-2 text-right font-mono font-bold whitespace-nowrap ${r.checked ? "text-rose-600" : "text-slate-200"}`} onClick={e => e.stopPropagation()}>
                          {r.checked ? `-${fmtBs(reembolso)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Panel inferior ──────────────────────────────────────── */}
            {seleccionados.length > 0 ? (
              <div className="space-y-4 border-t border-slate-200 pt-4">

                {/* Motivo + notas */}
                <div className="flex gap-3 flex-wrap">
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Motivo</p>
                    <select value={motivo} onChange={e => setMotivo(e.target.value as DevolucionIn["motivo"])}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-rose-400">
                      {Object.entries(MOTIVO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="flex-[2] min-w-[220px]">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Notas <span className="font-normal normal-case">(opcional)</span></p>
                    <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
                      placeholder="Ej. producto roto, talla incorrecta…"
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300" />
                  </div>
                </div>

                {/* Toggle cambio */}
                <button
                  onClick={() => { setConCambio(n => !n); setProdNuevo(null); setBusqProd(""); }}
                  className={`flex w-full items-center gap-3 rounded border-2 px-4 py-2.5 text-left transition-all ${conCambio ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <ArrowLeftRight className={`h-4 w-4 shrink-0 ${conCambio ? "text-emerald-600" : "text-slate-400"}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${conCambio ? "text-emerald-800" : "text-slate-700"}`}>
                      {conCambio ? "Con cambio de producto activado" : "¿El cliente se lleva otro producto a cambio?"}
                    </p>
                    <p className="text-xs text-slate-400">{conCambio ? "Selecciona el producto de reemplazo en la tabla" : "Si no, solo se procesa el reembolso"}</p>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${conCambio ? "bg-emerald-500" : "bg-slate-200"}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow ${conCambio ? "translate-x-6" : "translate-x-1"}`} />
                  </div>
                </button>

                {/* ── Tabla de reemplazo — IDÉNTICA a NuevaVentaPage ── */}
                {conCambio && (
                  <>
                    {/* Producto ya seleccionado */}
                    {prodNuevo && (
                      <div className="flex items-center gap-3 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-4 py-2.5">
                        <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-emerald-800 truncate">{prodNuevo.nombre}</p>
                          <p className="text-xs font-mono text-emerald-600">{prodNuevo.sku} · {fmtBs(prodNuevo.precio_venta)} c/u</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => setCantNueva(v => Math.max(1, v - 1))} className="w-7 h-7 rounded border border-emerald-300 bg-white text-emerald-600 hover:bg-emerald-100 font-bold flex items-center justify-center">−</button>
                          <span className="w-8 text-center text-sm font-bold text-emerald-800">{cantNueva}</span>
                          <button onClick={() => setCantNueva(v => v + 1)} className="w-7 h-7 rounded border border-emerald-300 bg-white text-emerald-600 hover:bg-emerald-100 font-bold flex items-center justify-center">+</button>
                          <span className="text-sm font-semibold text-emerald-600 ml-1">= {fmtBs(parseFloat(prodNuevo.precio_venta) * cantNueva)}</span>
                        </div>
                        <button onClick={() => { setProdNuevo(null); setBusqProd(""); }} className="text-slate-300 hover:text-red-400 ml-1 shrink-0"><X className="h-4 w-4" /></button>
                      </div>
                    )}

                    {/* Buscador + tabla completa — mismo formato que inventario/ventas */}
                    {!prodNuevo && (
                      <>
                        {/* Buscador idéntico al de NuevaVentaPage */}
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          {cargandoP && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-300" />}
                          <input autoFocus
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
                            placeholder="Buscar producto de reemplazo — nombre, SKU, marca, modelo, medida…"
                            value={busqProd}
                            onChange={e => setBusqProd(e.target.value)}
                          />
                          {busqProd && (
                            <button type="button" onClick={() => setBusqProd("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Tabla idéntica a NuevaVentaPage */}
                        <div className="overflow-auto border border-slate-200 rounded-lg" style={{ maxHeight: 360 }}>
                          <table className="border-collapse text-[11px]" style={{ minWidth: "max-content", width: "100%" }}>
                            <thead className="sticky top-0 z-30">
                              <tr>
                                <th className={TH_S} style={{ left: 0, width: W_FOTO, minWidth: W_FOTO }}>FOTO</th>
                                <th className={`${TH_S} relative select-none`} style={{ left: L_SKU, width: skuW, minWidth: skuW }}>
                                  CÓDIGO
                                  <div onMouseDown={makeResize(skuW, setSkuW)} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-amber-600/50" />
                                </th>
                                <th className={`${TH_S} relative select-none`} style={{ left: L_UNIV, width: univW, minWidth: univW }}>
                                  CÓD.{<br />}UNIV.
                                  <div onMouseDown={makeResize(univW, setUnivW)} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-amber-600/50" />
                                </th>
                                <th className={`${TH_S} relative select-none`} style={{ left: L_DESC, width: descW, minWidth: descW }}>
                                  DESCRIPCIÓN
                                  <div onMouseDown={makeResize(descW, setDescW)} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-amber-600/50" />
                                </th>
                                {["STOCK","MARCA","PROCEDENCIA","PRECIO FACTURA","PRECIO MAYOR","PRECIO TALLER","PRECIO MAYORISTA","MEDIDA","MODELO"].map(h => (
                                  <th key={h} className={TH_BASE}>
                                    {h.split(" ").map((w, i) => <React.Fragment key={i}>{i > 0 && <br />}{w}</React.Fragment>)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {cargandoP ? (
                                <tr><td colSpan={13} className="py-10 text-center text-slate-300"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                              ) : prods.length === 0 ? (
                                <tr><td colSpan={13} className="py-8 text-center text-sm text-slate-400">
                                  {busqProd ? `Sin resultados para "${busqProd}"` : "No hay productos"}
                                </td></tr>
                              ) : prods.map((p, idx) => {
                                const stock     = Math.round(Number(p.stock_total ?? 0));
                                const stockMin  = Math.round(parseFloat(p.stock_minimo));
                                const stockColor = stock === 0 ? "text-red-600 font-bold" : stock < stockMin ? "text-orange-500 font-bold" : "text-slate-800";
                                const bg = idx % 2 === 0 ? "#ffffff" : "#fffbeb";
                                const S = "border border-slate-200 px-1 py-1 sticky z-10";
                                const C = "border border-slate-200 px-2 py-1 whitespace-nowrap";
                                return (
                                  <tr key={p.id} onClick={() => { setProdNuevo(p); setCantNueva(1); setBusqProd(""); }}
                                    className="cursor-pointer hover:brightness-95"
                                    style={{ backgroundColor: bg }}>
                                    <td className={S} style={{ left: 0, width: W_FOTO, minWidth: W_FOTO, maxWidth: W_FOTO, backgroundColor: bg }}>
                                      <div className="w-7 h-7 rounded overflow-hidden bg-slate-100 flex items-center justify-center">
                                        {p.imagen_url ? <img src={p.imagen_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <ImageIcon className="h-3 w-3 text-slate-300" />}
                                      </div>
                                    </td>
                                    <td className={`${S} font-mono text-indigo-700 font-semibold`} style={{ left: L_SKU, width: skuW, minWidth: skuW, maxWidth: skuW, backgroundColor: bg }}>{p.sku}</td>
                                    <td className={`${S} font-mono text-slate-500`} style={{ left: L_UNIV, width: univW, minWidth: univW, maxWidth: univW, backgroundColor: bg }}>{p.codigo_universal ?? "—"}</td>
                                    <td className={`${S} text-slate-800 overflow-hidden`} style={{ left: L_DESC, width: descW, minWidth: descW, maxWidth: descW, backgroundColor: bg }}>
                                      <span className="block truncate">{p.nombre}</span>
                                    </td>
                                    <td className={`${C} text-center font-mono font-bold ${stockColor}`}>{stock}</td>
                                    <td className={`${C} text-slate-600`}>{p.marca ?? "—"}</td>
                                    <td className={`${C} text-slate-600`}>{p.procedencia ?? "—"}</td>
                                    <td className={`${C} font-mono text-right font-semibold text-emerald-700`}>{fmtBs(p.precio_venta)}</td>
                                    <td className={`${C} font-mono text-right text-slate-700`}>{p.precio_mayor ? fmtBs(p.precio_mayor) : "—"}</td>
                                    <td className={`${C} font-mono text-right text-slate-700`}>{p.precio_mecanico ? fmtBs(p.precio_mecanico) : "—"}</td>
                                    <td className={`${C} font-mono text-right text-blue-700`}>{p.precio_real ? fmtBs(p.precio_real) : "—"}</td>
                                    <td className={`${C} text-slate-500`}>{p.medidas ?? "—"}</td>
                                    <td className={`${C} text-slate-500`}>{p.modelos ?? "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Resumen financiero */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Productos a devolver</span>
                    <span className="font-semibold text-slate-700">{seleccionados.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Reembolso total</span>
                    <span className="font-mono font-semibold text-red-600">-{fmtBs(montoDevuelto)}</span>
                  </div>
                  {conCambio && prodNuevo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Cobrado por cambio</span>
                      <span className="font-mono font-semibold text-emerald-700">+{fmtBs(montoCobrado)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="font-bold text-slate-800 text-base">
                      {diferencia > 0 ? "Cliente paga diferencia:" : diferencia < 0 ? "Negocio devuelve:" : "Cambio exacto"}
                    </span>
                    <span className={`font-mono font-bold text-base ${diferencia > 0 ? "text-orange-600" : diferencia < 0 ? "text-red-600" : "text-green-600"}`}>
                      {fmtBs(Math.abs(diferencia))}
                    </span>
                  </div>
                </div>

                {/* Botón confirmar */}
                <Button onClick={confirmar} disabled={saving || (conCambio && !prodNuevo)}
                  className="w-full py-3 h-auto font-bold text-white text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-50">
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Registrando…</>
                    : `✓ Registrar Devolución${seleccionados.length > 1 ? ` (${seleccionados.length} productos)` : ""}`
                  }
                </Button>
              </div>
            ) : (
              <p className="text-center text-sm text-slate-400 py-4">
                Marca al menos un producto para continuar
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
