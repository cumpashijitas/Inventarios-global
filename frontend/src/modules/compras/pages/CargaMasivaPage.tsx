import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle, ChevronRight, Eye, FileSpreadsheet,
  HelpCircle, Loader2, Plus, Save, Search, Trash2, Upload, X,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { lotesApi, type InvData, type MatchStatus, type ParsedItem } from "@/modules/compras/services/lotesApi";
import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import type { Lote, Proveedor } from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos — fila editable de la planilla
// ─────────────────────────────────────────────────────────────────────────────
interface FilaProducto {
  id: string;
  // Mismos campos que tabla inventario admin, mismo orden
  sku: string;              // CÓDIGO MARCA
  codigoUniversal: string;  // CÓDIGO UNIVERSAL
  nombre: string;           // DESCRIPCIÓN
  marca: string;            // MARCA
  procedencia: string;      // PROCEDENCIA
  precioReal: string;       // COSTO COMPRA UNITARIO
  costoCaja: string;        // COSTO COMPRA CAJA
  precioUnitario: string;   // PRECIO FACTURA
  precioMayor: string;      // PRECIO POR MAYOR
  precioMecanico: string;   // PRECIO TALLER
  precioMayorista: string;  // PRECIO MAYORISTA
  categoria: string;        // CATEGORÍA
  industria: string;        // INDUSTRIA
  motor: string;            // MOTOR
  modelos: string;          // MODELO
  medidas: string;          // MEDIDA
  proveedor: string;        // PROVEEDOR
  cantidad: string;         // CANTIDAD
  stockMin: string;         // STOCK MÍNIMO
  // Matching
  matchStatus: MatchStatus | "manual";
  matchId?: string | null;
  matchNombre?: string | null;
  confianza?: number;
  invData?: InvData | null;
}

const FILA_VACIA = (): FilaProducto => ({
  id: Math.random().toString(36).slice(2),
  sku: "", codigoUniversal: "", nombre: "", marca: "", procedencia: "",
  precioReal: "", costoCaja: "", precioUnitario: "", precioMayor: "",
  precioMecanico: "", precioMayorista: "",
  categoria: "Motor", industria: "", motor: "",
  modelos: "", medidas: "", proveedor: "",
  cantidad: "0", stockMin: "5",
  matchStatus: "manual",
});

// ─── Estilos por estado de matching ──────────────────────────────────────────
const MATCH_STYLE: Record<string, { row: string; badge: string; label: string; icon: React.ElementType }> = {
  existente:  { row: "bg-blue-50/60 border-l-4 border-l-blue-400",   badge: "bg-blue-100 text-blue-700",   label: "Actualiza stock", icon: CheckCircle },
  probable:   { row: "bg-yellow-50/60 border-l-4 border-l-yellow-400", badge: "bg-yellow-100 text-yellow-700", label: "Verificar",      icon: HelpCircle },
  nuevo:      { row: "bg-green-50/60 border-l-4 border-l-green-400",  badge: "bg-green-100 text-green-700",  label: "Nuevo producto",  icon: Plus },
  incompleto: { row: "bg-red-50/60 border-l-4 border-l-red-400",     badge: "bg-red-100 text-red-700",     label: "Incompleto",      icon: AlertTriangle },
  manual:     { row: "", badge: "bg-slate-100 text-slate-500", label: "Manual", icon: FileSpreadsheet },
};

const COLUMNAS = [
  "#", "CÓDIGO MARCA", "CÓDIGO UNIVERSAL", "DESCRIPCIÓN", "MARCA", "PROCEDENCIA",
  "COSTO COMPRA UNITARIO", "COSTO COMPRA CAJA", "PRECIO FACTURA", "PRECIO POR MAYOR",
  "PRECIO TALLER", "PRECIO MAYORISTA",
  "CATEGORÍA", "INDUSTRIA", "MOTOR", "MODELO", "MEDIDA", "PROVEEDOR",
  "CANTIDAD", "STOCK MÍNIMO", "",
];
const CATEGORIAS = ["Motor", "Frenos", "Suspensión", "Filtros", "Eléctrico", "Lubricantes", "Transmisión", "Carrocería"];

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────
export default function CargaMasivaPage() {
  const [lotes, setLotes]           = useState<Lote[]>([]);
  const [busqLote, setBusqLote]     = useState("");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  const lotesFiltrados = useMemo(() => {
    const q = busqLote.toLowerCase().trim();
    if (!q) return lotes;
    return lotes.filter(l =>
      l.referencia.toLowerCase().includes(q) ||
      (l.proveedor_nombre ?? "").toLowerCase().includes(q) ||
      l.fecha.includes(q) ||
      (l.notas ?? "").toLowerCase().includes(q) ||
      l.estado.toLowerCase().includes(q)
    );
  }, [lotes, busqLote]);
  const [loteActivo, setLoteActivo] = useState<Lote | null>(null);
  const [filas, setFilas]           = useState<FilaProducto[]>([FILA_VACIA()]);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [archivoNombre, setArchivoNombre] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const [nuevoLote, setNuevoLote] = useState({
    referencia: "", proveedor_id: "", fecha: new Date().toISOString().split("T")[0], notas: "",
  });

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      lotesApi.listLotes({ page_size: 100 }).then((r) => setLotes(r.items)),
      inventarioApi.listProveedores({ page_size: 200, only_active: true }).then((r) => setProveedores(r.items)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  // ── Crear lote ────────────────────────────────────────────────────────────
  const handleCrearLote = async () => {
    if (!nuevoLote.referencia.trim()) return;
    setSaving(true);
    try {
      const prov = proveedores.find((p) => p.id === nuevoLote.proveedor_id);
      const nuevo = await lotesApi.createLote({
        referencia: nuevoLote.referencia,
        proveedor_id: nuevoLote.proveedor_id || undefined,
        proveedor_nombre: prov?.razon_social,
        fecha: nuevoLote.fecha || undefined,
        notas: nuevoLote.notas || undefined,
      });
      setLotes((prev) => [nuevo, ...prev]);
      setLoteActivo(nuevo);
      setFilas([FILA_VACIA()]);
      setModalNuevo(false);
      setNuevoLote({ referencia: "", proveedor_id: "", fecha: new Date().toISOString().split("T")[0], notas: "" });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Importación real de archivo ───────────────────────────────────────────
  const [advertenciasImport, setAdvertenciasImport] = useState<string[]>([]);
  const [resumenImport, setResumenImport] = useState<{existentes:number;probables:number;nuevos:number;incompletos:number} | null>(null);
  const [bannerExito, setBannerExito] = useState<string | null>(null);

  const handleImportarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input para permitir re-subir el mismo archivo
    e.target.value = "";
    setArchivoNombre(file.name);
    setProcesando(true);
    setAdvertenciasImport([]);
    setResumenImport(null);
    try {
      const result = await lotesApi.parseArchivo(file);
      if (result.items.length === 0) {
        setAdvertenciasImport(result.advertencias.length ? result.advertencias : ["No se encontraron productos en el archivo."]);
        return;
      }
      // Convertir ParsedItem[] → FilaProducto[]
      const nuevasFilas: FilaProducto[] = result.items.map((item: ParsedItem) => {
        const isMatch = item.match_status === "existente" || item.match_status === "probable";
        const inv     = item.inv_data;

        return {
          ...FILA_VACIA(),
          sku: item.sku ?? "",
          // Si hay match: datos del inventario. Si es nuevo: datos del PDF.
          nombre:          isMatch && inv?.nombre          ? inv.nombre          : (item.nombre   ?? ""),
          marca:           isMatch && inv?.marca           ? inv.marca           : (item.marca    ?? ""),
          medidas:         isMatch && inv?.medidas         ? inv.medidas         : "",
          modelos:         isMatch && inv?.modelos         ? inv.modelos         : (item.modelos  ?? ""),
          codigoUniversal: isMatch && inv?.codigo_universal ? inv.codigo_universal : "",
          procedencia:     isMatch && inv?.procedencia     ? inv.procedencia     : "",
          industria:       isMatch && inv?.industria       ? inv.industria       : "",
          motor:           isMatch && inv?.motor           ? inv.motor           : "",
          // Precios: siempre del PDF (vienen del proveedor)
          precioReal:      item.precio_compra ?? "",
          cantidad:        item.cantidad      ?? "0",
          // Matching
          matchStatus: item.match_status,
          matchId:     item.match_id,
          matchNombre: item.match_nombre,
          confianza:   item.confianza,
          invData:     item.inv_data ?? null,
        };
      });
      setFilas(nuevasFilas);
      setAdvertenciasImport(result.advertencias);
      // Resumen
      const s = { existentes: 0, probables: 0, nuevos: 0, incompletos: 0 };
      for (const f of nuevasFilas) {
        if (f.matchStatus === "existente") s.existentes++;
        else if (f.matchStatus === "probable") s.probables++;
        else if (f.matchStatus === "nuevo") s.nuevos++;
        else if (f.matchStatus === "incompleto") s.incompletos++;
      }
      setResumenImport(s);
    } catch (err) {
      console.error(err);
      setAdvertenciasImport(["Error al procesar el archivo. Verifica que sea un PDF o Excel válido."]);
    } finally {
      setProcesando(false);
    }
  };

  // ── Edición de filas ──────────────────────────────────────────────────────
  const updateFila = (id: string, campo: keyof FilaProducto, valor: string) => {
    setFilas((prev) => prev.map((f) => f.id === id ? { ...f, [campo]: valor } : f));
  };
  const agregarFila = () => setFilas((prev) => [...prev, FILA_VACIA()]);
  const eliminarFila = (id: string) => setFilas((prev) => prev.filter((f) => f.id !== id));

  // ── Guardar: salva ítems + actualiza inventario en un paso ───────────────
  const handleGuardarLote = async () => {
    if (!loteActivo) return;
    const filasValidas = filas.filter((f) => f.sku.trim() && f.nombre.trim());
    if (filasValidas.length === 0) {
      setBannerExito(null);
      setAdvertenciasImport(["Agrega al menos un producto con SKU y nombre antes de guardar."]);
      return;
    }
    setSaving(true);
    setBannerExito(null);

    // Convierte string/number a número; retorna fallback si no es numérico válido
    const toNum = (s: string | number | null | undefined, fallback: number | undefined = undefined) => {
      if (s === null || s === undefined) return fallback;
      if (typeof s === "number") return isNaN(s) || !isFinite(s) ? fallback : s;
      if (!s.trim()) return fallback;
      const n = parseFloat(s.replace(",", "."));
      return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    try {
      const items = filasValidas.map((f) => ({
        sku:              f.sku.trim(),
        nombre:           f.nombre.trim(),
        categoria:        f.categoria        || undefined,
        marca:            f.marca            || undefined,
        codigo_universal: f.codigoUniversal  || undefined,
        procedencia:      f.procedencia      || undefined,
        industria:        f.industria        || undefined,
        motor:            f.motor            || undefined,
        modelos:          f.modelos          || undefined,
        medidas:          f.medidas          || undefined,
        proveedor:        f.proveedor        || undefined,
        precio_real:      toNum(f.precioReal),
        costo_caja:       toNum(f.costoCaja),
        precio_unitario:  toNum(f.precioUnitario),
        precio_mayor:     toNum(f.precioMayor),
        precio_mecanico:  toNum(f.precioMecanico),
        precio_mayorista: toNum(f.precioMayorista),
        cantidad:         toNum(f.cantidad, 0),
        stock_minimo:     toNum(f.stockMin,  1),
      }));

      const updated = await lotesApi.guardar(loteActivo.id, items as Parameters<typeof lotesApi.guardar>[1]);
      setLotes((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      setLoteActivo(updated);
      // Refrescar filas con los datos guardados
      if (updated.items?.length) {
        setFilas(updated.items.map(itemToFila));
      }
      setBannerExito(`✓ ${filasValidas.length} productos guardados. Inventario actualizado.`);
      setAdvertenciasImport([]);
    } catch (err: unknown) {
      console.error(err);
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      let errMsg = "Error al guardar. Revisa los datos e intenta de nuevo.";
      if (data && typeof data === "object") {
        const detail = (data as { detail?: unknown }).detail;
        if (typeof detail === "string") {
          errMsg = detail;
        } else if (Array.isArray(detail)) {
          // FastAPI 422: [{type, loc, msg, input}]
          errMsg = detail
            .map((e: { msg?: string; loc?: unknown[] }) =>
              `${String(e.loc?.at(-1) ?? "campo")}: ${e.msg ?? "inválido"}`)
            .join(" · ");
        }
      }
      setAdvertenciasImport([errMsg]);
    } finally { setSaving(false); }
  };

  // ── Eliminar lote ─────────────────────────────────────────────────────────
  const handleEliminarLote = async (lote: Lote) => {
    if (!window.confirm(`¿Eliminar lote ${lote.referencia}?`)) return;
    try {
      await lotesApi.deleteLote(lote.id);
      setLotes((prev) => prev.filter((l) => l.id !== lote.id));
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400 text-sm">Cargando lotes…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            Carga Masiva de Productos
          </h1>
          <p className="text-sm text-slate-500">Gestiona lotes de compra y carga productos desde archivos o manualmente</p>
        </div>
        <Button onClick={() => setModalNuevo(true)} className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm">
          <Plus className="h-4 w-4" /> Nuevo Lote de Compra
        </Button>
      </div>

      {/* Lista de lotes */}
      {!loteActivo && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileSpreadsheet className="h-4 w-4 text-teal-500" /> Lotes de Compra
            </p>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white"
                placeholder="Buscar por referencia, proveedor, fecha o estado…"
                value={busqLote}
                onChange={e => setBusqLote(e.target.value)}
              />
            </div>
            {busqLote && (
              <span className="text-xs text-slate-400">{lotesFiltrados.length} resultado{lotesFiltrados.length !== 1 ? "s" : ""}</span>
            )}
          </div>
          {lotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <FileSpreadsheet className="h-10 w-10 mb-3" />
              <p className="text-sm">Aún no hay lotes de compra</p>
              <Button onClick={() => setModalNuevo(true)} className="mt-4 bg-teal-600 hover:bg-teal-700 text-white text-sm">
                <Plus className="h-4 w-4 mr-1" /> Crear primer lote
              </Button>
            </div>
          ) : lotesFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-300">
              <Search className="h-8 w-8 mb-2" />
              <p className="text-sm">Sin resultados para "{busqLote}"</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lotesFiltrados.map((l) => (
                <div key={l.id} className="flex w-full items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors">
                  <button
                    onClick={() => { setLoteActivo(l); setFilas(l.items?.map(itemToFila) ?? [FILA_VACIA()]); setArchivoNombre(""); }}
                    className="flex flex-1 items-center gap-4 text-left"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      l.estado === "activo" ? "bg-teal-50 text-teal-600" :
                      l.estado === "confirmado" ? "bg-green-50 text-green-600" :
                      "bg-slate-100 text-slate-400"
                    }`}>
                      {l.estado === "confirmado" ? <CheckCircle className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{l.referencia}</p>
                      <p className="text-xs text-indigo-500">{l.proveedor_nombre ?? "Sin proveedor"} · {l.fecha}</p>
                      {l.notas && <p className="text-xs text-slate-400 truncate">{l.notas}</p>}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="font-semibold text-slate-800">{l.productos_count}</p>
                        <p className="text-xs text-slate-400">productos</p>
                      </div>
                      {l.total_estimado && (
                        <div className="text-right">
                          <p className="font-semibold text-slate-800">{fmtBs(l.total_estimado)}</p>
                          <p className="text-xs text-slate-400">total ingresado</p>
                        </div>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        l.estado === "activo" ? "bg-teal-100 text-teal-700" :
                        l.estado === "confirmado" ? "bg-green-100 text-green-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {l.estado}
                      </span>
                      {l.estado === "confirmado"
                        ? <Eye className="h-4 w-4 text-green-400" />
                        : <ChevronRight className="h-4 w-4 text-slate-300" />
                      }
                    </div>
                  </button>
                  <button onClick={() => handleEliminarLote(l)} className="rounded p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Resumen lote confirmado (solo lectura) ── */}
      {loteActivo && loteActivo.estado === "confirmado" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="rounded-xl border border-green-200 bg-white shadow-sm px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => { setLoteActivo(null); setFilas([]); }} className="text-xs text-indigo-600 hover:underline">
                ← Lotes
              </button>
              <span className="text-slate-300">/</span>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{loteActivo.referencia}</p>
                  <p className="text-xs text-slate-400">
                    {loteActivo.proveedor_nombre ?? "Sin proveedor"} · {loteActivo.fecha}
                  </p>
                </div>
              </div>
              <span className="ml-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Confirmado</span>
              <div className="ml-auto flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-800">{loteActivo.productos_count}</p>
                  <p className="text-xs text-slate-400">productos ingresados</p>
                </div>
                {loteActivo.total_estimado && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-teal-700">{fmtBs(loteActivo.total_estimado)}</p>
                    <p className="text-xs text-slate-400">total del lote</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabla de items del lote */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-sm font-semibold text-slate-700">Productos ingresados en este lote</p>
            </div>
            {(!loteActivo.items || loteActivo.items.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                <FileSpreadsheet className="h-8 w-8 mb-2" />
                <p className="text-sm">No hay detalle de ítems disponible</p>
              </div>
            ) : (
              <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
                <table className="border-collapse text-[11px]" style={{ minWidth: "max-content", width: "100%" }}>
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {["#", "CANTIDAD", "STOCK MÍN.", "CÓDIGO MARCA", "CÓDIGO UNIVERSAL", "DESCRIPCIÓN", "MARCA", "PROCEDENCIA",
                        "COSTO COMPRA UNIT.", "COSTO COMPRA CAJA", "PRECIO FACTURA", "PRECIO POR MAYOR", "PRECIO TALLER", "PRECIO MAYORISTA",
                        "CATEGORÍA", "INDUSTRIA", "MOTOR", "MODELO", "MEDIDA", "PROVEEDOR"].map(h => (
                        <th key={h} className="border border-amber-500 bg-amber-400 px-2 py-2 text-center font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loteActivo.items.map((item: any, idx: number) => (
                      <tr key={item.id ?? idx} className={idx % 2 === 0 ? "bg-white" : "bg-amber-50/40"}>
                        <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center font-mono font-bold text-teal-700">{parseFloat(item.cantidad ?? 0).toFixed(0)}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center font-mono text-slate-500">{parseFloat(item.stock_minimo ?? 0).toFixed(0)}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-mono text-indigo-700 font-semibold whitespace-nowrap">{item.sku}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-mono text-slate-500 whitespace-nowrap">{item.codigo_universal ?? "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-semibold text-slate-800 max-w-[200px] truncate">{item.nombre}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 whitespace-nowrap">{item.marca ?? "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 whitespace-nowrap">{item.procedencia ?? "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-mono text-right text-slate-700 whitespace-nowrap">{item.precio_real ? fmtBs(item.precio_real) : "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-mono text-right text-slate-500 whitespace-nowrap">{item.costo_caja ? fmtBs(item.costo_caja) : "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-mono text-right font-semibold text-emerald-700 whitespace-nowrap">{item.precio_unitario ? fmtBs(item.precio_unitario) : "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-mono text-right text-slate-700 whitespace-nowrap">{item.precio_mayor ? fmtBs(item.precio_mayor) : "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-mono text-right text-slate-700 whitespace-nowrap">{item.precio_mecanico ? fmtBs(item.precio_mecanico) : "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-mono text-right text-blue-700 whitespace-nowrap">{item.precio_mayorista ? fmtBs(item.precio_mayorista) : "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 whitespace-nowrap">{item.categoria ?? "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 whitespace-nowrap">{item.industria ?? "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 whitespace-nowrap">{item.motor ?? "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-500 max-w-[130px] truncate">{item.modelos ?? "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-500 whitespace-nowrap">{item.medidas ?? "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600 whitespace-nowrap">{item.proveedor ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor del lote activo */}
      {loteActivo && loteActivo.estado !== "confirmado" && (
        <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 145px)" }}>
          {/* Header del lote */}
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => { setLoteActivo(null); setFilas([]); setArchivoNombre(""); }} className="text-xs text-indigo-600 hover:underline">
                ← Lotes
              </button>
              <span className="text-slate-300">/</span>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{loteActivo.referencia}</p>
                  <p className="text-xs text-slate-400">
                    {loteActivo.proveedor_nombre ?? "Sin proveedor"} · {loteActivo.fecha} · {filas.filter((f) => f.sku).length} productos
                  </p>
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={handleImportarArchivo} />
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5 text-sm" disabled={procesando || saving}>
                  {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {procesando ? "Analizando…" : "Importar Archivo"}
                </Button>
                <Button variant="outline" onClick={agregarFila} className="gap-1.5 text-sm" disabled={saving}>
                  <Plus className="h-4 w-4" /> Agregar Fila
                </Button>
                <Button
                  onClick={handleGuardarLote}
                  disabled={saving || procesando}
                  className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm min-w-[110px]"
                >
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                    : <><Save className="h-4 w-4" /> Guardar</>}
                </Button>
                <button
                  onClick={() => { setLoteActivo(null); setFilas([]); setBannerExito(null); setResumenImport(null); setAdvertenciasImport([]); }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {bannerExito && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-700 font-medium">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                {bannerExito}
              </div>
            )}
            {procesando && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analizando <strong>{archivoNombre}</strong>…
              </div>
            )}
            {!procesando && resumenImport && (
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-xs">
                <span className="font-semibold text-teal-700">
                  <FileSpreadsheet className="inline h-3.5 w-3.5 mr-1" />{archivoNombre}
                </span>
                <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 font-medium">
                  🔵 {resumenImport.existentes} actualizan stock
                </span>
                <span className="rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 font-medium">
                  🟡 {resumenImport.probables} verificar
                </span>
                <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 font-medium">
                  🟢 {resumenImport.nuevos} nuevos
                </span>
                {resumenImport.incompletos > 0 && (
                  <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-medium">
                    🔴 {resumenImport.incompletos} incompletos
                  </span>
                )}
              </div>
            )}
            {!procesando && advertenciasImport.length > 0 && (
              <div className="mt-2 space-y-1">
                {advertenciasImport.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-xs text-orange-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla editable */}
          <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  {COLUMNAS.map((c) => (
                    <th key={c} className="border border-amber-500 bg-amber-400 px-3 py-2 text-left font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((fila, idx) => {
                  const style = MATCH_STYLE[fila.matchStatus] ?? MATCH_STYLE.manual;
                  const BadgeIcon = style.icon;
                  return (
                  <React.Fragment key={fila.id}>
                  <tr className={`${style.row} hover:brightness-95 transition-all`}>
                    <td className="px-3 py-2 text-slate-400 text-center w-8">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px]">{idx + 1}</span>
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${style.badge}`}>
                          <BadgeIcon className="h-2.5 w-2.5" />
                          {style.label}
                        </span>
                      </div>
                    </td>
                    <CeldaEdit value={fila.sku}              onChange={(v) => updateFila(fila.id, "sku", v)}              placeholder="FLT-ACE-001" className="w-32 font-mono" />
                    <CeldaEdit value={fila.codigoUniversal} onChange={(v) => updateFila(fila.id, "codigoUniversal", v)} placeholder="90915-YZZD4" className="w-28 font-mono" />
                    <CeldaEdit value={fila.nombre}           onChange={(v) => updateFila(fila.id, "nombre", v)}           placeholder="Nombre del producto" className="w-48" />
                    <CeldaEdit value={fila.marca}            onChange={(v) => updateFila(fila.id, "marca", v)}            placeholder="Marca" className="w-24" />
                    <CeldaEdit value={fila.procedencia}      onChange={(v) => updateFila(fila.id, "procedencia", v)}      placeholder="Japón, China..." className="w-24" />
                    <CeldaEdit value={fila.precioReal}       onChange={(v) => updateFila(fila.id, "precioReal", v)}       placeholder="0.00" className="w-20" type="number" />
                    <CeldaEdit value={fila.costoCaja}        onChange={(v) => updateFila(fila.id, "costoCaja", v)}        placeholder="0.00" className="w-20" type="number" />
                    <CeldaEdit value={fila.precioUnitario}   onChange={(v) => updateFila(fila.id, "precioUnitario", v)}   placeholder="0.00" className="w-20" type="number" />
                    <CeldaEdit value={fila.precioMayor}      onChange={(v) => updateFila(fila.id, "precioMayor", v)}      placeholder="0.00" className="w-20" type="number" />
                    <CeldaEdit value={fila.precioMecanico}   onChange={(v) => updateFila(fila.id, "precioMecanico", v)}   placeholder="0.00" className="w-20" type="number" />
                    <CeldaEdit value={fila.precioMayorista}  onChange={(v) => updateFila(fila.id, "precioMayorista", v)}  placeholder="0.00" className="w-20" type="number" />
                    <td className="px-2 py-1.5">
                      <select value={fila.categoria} onChange={(e) => updateFila(fila.id, "categoria", e.target.value)}
                        className="w-28 rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <CeldaEdit value={fila.industria}   onChange={(v) => updateFila(fila.id, "industria", v)}   placeholder="Automotriz..." className="w-24" />
                    <CeldaEdit value={fila.motor}       onChange={(v) => updateFila(fila.id, "motor", v)}       placeholder="4AGE, 2JZ..." className="w-24" />
                    <CeldaEdit value={fila.modelos}     onChange={(v) => updateFila(fila.id, "modelos", v)}     placeholder="Corolla, Civic..." className="w-36" />
                    <CeldaEdit value={fila.medidas}     onChange={(v) => updateFila(fila.id, "medidas", v)}     placeholder="Ø65mm H:75" className="w-24" />
                    <CeldaEdit value={fila.proveedor}   onChange={(v) => updateFila(fila.id, "proveedor", v)}   placeholder="Proveedor" className="w-32" />
                    <CeldaEdit value={fila.cantidad}    onChange={(v) => updateFila(fila.id, "cantidad", v)}    placeholder="0" className="w-16" type="number" />
                    <CeldaEdit value={fila.stockMin}    onChange={(v) => updateFila(fila.id, "stockMin", v)}    placeholder="5" className="w-16" type="number" />
                    <td className="px-2 py-1.5">
                      <button onClick={() => eliminarFila(fila.id)} className="rounded p-1 text-slate-300 hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                  {/* Fila de referencia del inventario (solo para matches) */}
                  {fila.invData && (fila.matchStatus === "existente" || fila.matchStatus === "probable") && (
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <td colSpan={COLUMNAS.length} className="px-3 py-1.5">
                        <InvDataBar inv={fila.invData} />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-5 py-3">
              <button onClick={agregarFila} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800">
                <Plus className="h-3.5 w-3.5" /> Agregar fila
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo lote */}
      <Dialog open={modalNuevo} onOpenChange={setModalNuevo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <Plus className="h-4 w-4" />
              </div>
              Nuevo Lote de Compra
            </DialogTitle>
            <p className="text-xs text-slate-400 pt-1">Registra los datos del lote antes de cargar productos</p>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold text-slate-600">Referencia / Orden de Compra *</Label>
              <Input className="mt-1" placeholder="Ej: OC-2026-004"
                value={nuevoLote.referencia}
                onChange={(e) => setNuevoLote((p) => ({ ...p, referencia: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600">Proveedor</Label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={nuevoLote.proveedor_id}
                  onChange={(e) => setNuevoLote((p) => ({ ...p, proveedor_id: e.target.value }))}>
                  <option value="">— Sin proveedor —</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">Fecha</Label>
                <input type="date"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={nuevoLote.fecha}
                  onChange={(e) => setNuevoLote((p) => ({ ...p, fecha: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">Notas</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={2} placeholder="Detalles adicionales del lote..."
                value={nuevoLote.notas}
                onChange={(e) => setNuevoLote((p) => ({ ...p, notas: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNuevo(false)}>Cancelar</Button>
            <Button onClick={handleCrearLote} disabled={!nuevoLote.referencia.trim() || saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? "Creando…" : "Crear Lote y Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convierte un LoteItem del API a una FilaProducto editable */
function itemToFila(item: Lote["items"][number]): FilaProducto {
  return {
    id: item.id ?? Math.random().toString(36).slice(2),
    sku: item.sku ?? "",
    nombre: item.nombre ?? "",
    categoria: item.categoria ?? "Motor",
    marca: item.marca ?? "",
    precioReal: item.precio_real ?? "",
    precioUnitario: item.precio_unitario ?? "",
    precioMecanico: item.precio_mecanico ?? "",
    precioMayor: item.precio_mayor ?? "",
    cantidad: item.cantidad ?? "0",
    stockMin: item.stock_minimo ?? "5",
    ubicacion: item.ubicacion ?? "",
    proveedor: item.proveedor ?? "",
    aplicacion: item.aplicacion ?? "",
    medidas: item.medidas ?? "",
    peso: item.peso ?? "",
    modelos: item.modelos ?? "",
    anioDesde: item.anio_desde ? String(item.anio_desde) : "",
    anioHasta: item.anio_hasta ? String(item.anio_hasta) : "",
    descripcion: item.descripcion ?? "",
  };
}

/** Barra de referencia con los datos actuales del inventario para un producto con match */
function InvDataBar({ inv }: { inv: InvData }) {
  const campos: { label: string; value: string | number | null | undefined }[] = [
    { label: "Nombre",    value: inv.nombre },
    { label: "Marca",     value: inv.marca },
    { label: "P.Compra",  value: inv.precio_compra },
    { label: "P.Venta",   value: inv.precio_venta },
    { label: "P.Mecánico",value: inv.precio_mecanico },
    { label: "P.Mayor",   value: inv.precio_mayor },
    { label: "Aplicación",value: inv.aplicacion },
    { label: "Medidas",   value: inv.medidas },
    { label: "Modelos",   value: inv.modelos },
    { label: "Años",      value: inv.anio_desde && inv.anio_hasta ? `${inv.anio_desde}–${inv.anio_hasta}` : (inv.anio_desde ?? inv.anio_hasta) },
    { label: "Descripción",value: inv.descripcion },
  ].filter((c) => c.value !== null && c.value !== undefined && c.value !== "");

  if (campos.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
        Inventario actual →
      </span>
      {campos.map((c) => (
        <span key={c.label} className="text-[10px] text-slate-400">
          <span className="font-semibold text-slate-500">{c.label}:</span>{" "}
          <span className="font-mono">{String(c.value)}</span>
        </span>
      ))}
    </div>
  );
}

/** Celda editable de la tabla */
function CeldaEdit({ value, onChange, placeholder, className = "", type = "text" }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; className?: string; type?: string;
}) {
  return (
    <td className="px-2 py-1.5">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-slate-700 placeholder:text-slate-300 hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:outline-none ${className}`}
      />
    </td>
  );
}
