import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Eye,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { cajaApi } from "@/modules/ventas/services/cajaApi";
import type { MovimientoCaja, SesionCaja, SesionResumen } from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";

type ModalTipo = "abrir" | "ingreso" | "retiro" | "cerrar" | null;
type Tab = "hoy" | "historial";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatHora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });

const formatFechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });

// ── Badge por tipo ────────────────────────────────────────────────────────────
function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    venta:    { label: "Venta",    cls: "bg-emerald-100 text-emerald-700" },
    ingreso:  { label: "Ingreso",  cls: "bg-blue-100 text-blue-700" },
    retiro:   { label: "Retiro",   cls: "bg-red-100 text-red-700" },
    apertura: { label: "Apertura", cls: "bg-slate-100 text-slate-600" },
    cierre:   { label: "Cierre",   cls: "bg-slate-100 text-slate-600" },
  };
  const { label, cls } = map[tipo] ?? { label: tipo, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  return estado === "abierta" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Abierta
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      <Lock className="h-3 w-3" /> Cerrada
    </span>
  );
}

// ── Tabla de movimientos (reutilizable) ───────────────────────────────────────
function TablaMovimientos({ movimientos }: { movimientos: MovimientoCaja[] }) {
  if (movimientos.length === 0) {
    return <p className="py-4 text-center text-xs text-slate-400">Sin movimientos registrados.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {["HORA", "TIPO", "REFERENCIA", "MÉTODO", "MONTO", "SALDO"].map((h) => (
              <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold tracking-wider text-slate-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {movimientos.map((m) => {
            const montoNum = parseFloat(m.monto);
            const saldoNum = parseFloat(m.saldo_acumulado);
            return (
              <tr key={m.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{formatHora(m.created_at)}</td>
                <td className="px-4 py-2.5"><TipoBadge tipo={m.tipo} /></td>
                <td className="px-4 py-2.5 max-w-[160px] truncate text-slate-700">
                  {m.referencia ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs capitalize text-slate-500">
                  {m.metodo_pago ? m.metodo_pago.replace(/_/g, " ") : <span className="text-slate-300">—</span>}
                </td>
                <td className={`px-4 py-2.5 font-semibold tabular-nums ${montoNum >= 0 ? "text-slate-800" : "text-red-600"}`}>
                  {montoNum >= 0 ? "+" : ""}{montoNum.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 font-semibold tabular-nums text-slate-700">{fmtBs(saldoNum)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// PÁGINA PRINCIPAL
// =============================================================================
export default function CajaPage() {
  const [activeTab, setActiveTab] = useState<Tab>("hoy");

  // ── Estado del día ────────────────────────────────────────────────────────
  const [sesion, setSesion]           = useState<SesionCaja | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState<ModalTipo>(null);
  const [saving, setSaving]           = useState(false);

  // Abrir caja
  const [saldoInicial, setSaldoInicial] = useState("0");
  const [cajeroNombre, setCajeroNombre] = useState("");
  // Ingreso/retiro
  const [monto, setMonto]         = useState("");
  const [concepto, setConcepto]   = useState("");
  const [notas, setNotas]         = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  // Cerrar caja
  const [saldoContado, setSaldoContado] = useState("");
  const [notasCierre, setNotasCierre]   = useState("");

  // ── Historial ──────────────────────────────────────────────────────────────
  const [historial, setHistorial]           = useState<SesionResumen[]>([]);
  const [histTotal, setHistTotal]           = useState(0);
  const [histPage, setHistPage]             = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [histDesde, setHistDesde]           = useState("");
  const [histHasta, setHistHasta]           = useState("");
  const [histLoading, setHistLoading]       = useState(false);
  const [sesionDetalle, setSesionDetalle]   = useState<SesionCaja | null>(null);
  const [modalDetalle, setModalDetalle]     = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);

  // ── Carga caja del día ────────────────────────────────────────────────────
  const cargar = async () => {
    setLoading(true);
    try {
      const s = await cajaApi.getEstado();
      setSesion(s);
      setMovimientos(s?.movimientos ?? []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // ── Carga historial ───────────────────────────────────────────────────────
  const cargarHistorial = async (page = 1) => {
    setHistLoading(true);
    try {
      const result = await cajaApi.getHistorial(
        page,
        histDesde || undefined,
        histHasta || undefined,
      );
      setHistorial(result.items);
      setHistTotal(result.total);
      setHistPage(result.page);
      setHistTotalPages(result.total_pages);
    } catch (err) { console.error(err); }
    finally { setHistLoading(false); }
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    if (activeTab === "historial") cargarHistorial(1);
  }, [activeTab]);

  // ── Abrir detalle de sesión ───────────────────────────────────────────────
  const verDetalle = async (id: string) => {
    setDetalleLoading(true);
    setModalDetalle(true);
    setSesionDetalle(null);
    try {
      const det = await cajaApi.getSesion(id);
      setSesionDetalle(det);
    } catch (err) { console.error(err); }
    finally { setDetalleLoading(false); }
  };

  // ── Resumen del día ───────────────────────────────────────────────────────
  const ventasMovs   = movimientos.filter((m) => m.tipo === "venta");
  const ingresosMovs = movimientos.filter((m) => m.tipo === "ingreso");
  const retirosMovs  = movimientos.filter((m) => m.tipo === "retiro");
  const totalIngresos = [...ventasMovs, ...ingresosMovs].reduce((s, m) => s + parseFloat(m.monto), 0);
  const totalRetiros  = retirosMovs.reduce((s, m) => s + Math.abs(parseFloat(m.monto)), 0);
  const numVentas     = ventasMovs.length;
  const saldoActual   = parseFloat(sesion?.saldo_actual ?? sesion?.saldo_inicial ?? "0");
  const saldoContadoNum = parseFloat(saldoContado || "0");
  const diferenciaCierre = saldoContadoNum - saldoActual;

  // ── Acciones caja del día ────────────────────────────────────────────────
  const closeModal = () => {
    setModal(null);
    setMonto(""); setConcepto(""); setNotas(""); setMetodoPago("efectivo");
    setSaldoContado(""); setNotasCierre("");
  };

  const handleAbrir = async () => {
    setSaving(true);
    try {
      const nueva = await cajaApi.abrirCaja({
        saldo_inicial: parseFloat(saldoInicial || "0"),
        cajero_nombre: cajeroNombre || undefined,
      });
      setSesion(nueva);
      setMovimientos(nueva.movimientos ?? []);
      setModal(null);
      setSaldoInicial("0"); setCajeroNombre("");
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleMovimiento = async () => {
    if (!monto || !sesion) return;
    setSaving(true);
    try {
      await cajaApi.registrarMovimiento({
        tipo:        modal === "ingreso" ? "ingreso" : "retiro",
        monto:       parseFloat(monto),
        referencia:  concepto || undefined,
        notas:       notas || undefined,
        metodo_pago: metodoPago,
      });
      await cargar();
      closeModal();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleCerrar = async () => {
    if (!sesion) return;
    setSaving(true);
    try {
      const cerrada = await cajaApi.cerrarCaja(sesion.id, {
        saldo_final: saldoContadoNum || saldoActual,
        notas: notasCierre || undefined,
      });
      setSesion(cerrada);
      closeModal();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const cajaAbierta = sesion?.estado === "abierta";

  // ── Resumen de una sesión del historial (para modal detalle) ──────────────
  const detalleMovs = sesionDetalle?.movimientos ?? [];
  const detVentas   = detalleMovs.filter((m) => m.tipo === "venta");
  const detIngresos = detalleMovs.filter((m) => m.tipo === "ingreso");
  const detRetiros  = detalleMovs.filter((m) => m.tipo === "retiro");
  const detTotalIn  = [...detVentas, ...detIngresos].reduce((s, m) => s + parseFloat(m.monto), 0);
  const detTotalRet = detRetiros.reduce((s, m) => s + Math.abs(parseFloat(m.monto)), 0);
  const detSaldoCalc = parseFloat(sesionDetalle?.saldo_actual ?? "0");

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
        Cargando caja…
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestión de Caja</h1>
          <p className="text-sm text-slate-500">Control de efectivo y transacciones</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={activeTab === "hoy" ? cargar : () => cargarHistorial(histPage)}
            variant="outline" size="sm" className="gap-1.5" title="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {activeTab === "hoy" && !cajaAbierta && (
            <Button onClick={() => setModal("abrir")}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
              <Plus className="h-4 w-4" /> Abrir Caja
            </Button>
          )}
          {activeTab === "hoy" && cajaAbierta && (
            <>
              <Button onClick={() => setModal("ingreso")}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
                <Plus className="h-4 w-4" /> Ingreso
              </Button>
              <Button onClick={() => setModal("retiro")} variant="outline"
                className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 text-sm">
                <Minus className="h-4 w-4" /> Retiro
              </Button>
              <Button onClick={() => setModal("cerrar")}
                className="gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm">
                <Lock className="h-4 w-4" /> Cerrar Caja
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-200">
        {([ ["hoy", "Caja del Día", Clock], ["historial", "Historial", Calendar] ] as const).map(
          ([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          )
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: CAJA DEL DÍA
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "hoy" && (
        <>
          {/* Banner de estado */}
          {sesion ? (
            <div className="rounded-xl bg-indigo-600 px-6 py-5 text-white shadow-md">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Estado</p>
                  <p className="mt-1 text-lg font-bold">
                    {sesion.estado === "abierta" ? "🟢 Abierta" : "🔒 Cerrada"}
                  </p>
                  <p className="text-xs text-indigo-300 mt-0.5">{sesion.codigo}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Cajero</p>
                  <p className="mt-1 font-semibold truncate">{sesion.cajero_nombre ?? "—"}</p>
                  <p className="text-xs text-indigo-300 mt-0.5">Apertura {formatHora(sesion.abierta_en)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Saldo Inicial</p>
                  <p className="mt-1 text-lg font-bold">{fmtBs(sesion.saldo_inicial)}</p>
                  <p className="text-xs text-indigo-300 mt-0.5">{formatFecha(sesion.abierta_en)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Saldo Actual</p>
                  <p className="mt-1 text-3xl font-extrabold">{fmtBs(saldoActual)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-12 text-center">
              <Lock className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-slate-600 font-semibold">No hay caja abierta</p>
              <p className="text-sm text-slate-400 mt-1">Abre una sesión de caja para comenzar a registrar movimientos.</p>
              <Button onClick={() => setModal("abrir")} className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <Plus className="h-4 w-4" /> Abrir Caja
              </Button>
            </div>
          )}

          {cajaAbierta && (
            <>
              {/* Stats */}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold text-slate-700">Métodos de Pago</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-slate-100 px-5 pb-4">
                    {(sesion?.metodos_pago ?? []).length === 0 ? (
                      <p className="py-3 text-xs text-slate-400">Sin transacciones aún</p>
                    ) : (
                      sesion!.metodos_pago.map((m) => (
                        <div key={m.metodo_pago} className="flex items-center justify-between py-2.5 first:pt-1">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                              <DollarSign className="h-4 w-4 text-indigo-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium capitalize text-slate-700">{m.metodo_pago.replace(/_/g, " ")}</p>
                              <p className="text-xs text-slate-400">{m.transacciones} transacción{m.transacciones !== 1 ? "es" : ""}</p>
                            </div>
                          </div>
                          <span className="font-semibold text-slate-800 text-sm">{fmtBs(m.total)}</span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4 lg:col-span-2">
                  {[
                    { icon: ArrowUpRight, color: "emerald", label: "Ingresos", value: fmtBs(totalIngresos), sub: `${ventasMovs.length + ingresosMovs.length} transacciones` },
                    { icon: ArrowDownLeft, color: "red", label: "Retiros", value: fmtBs(totalRetiros), sub: `${retirosMovs.length} retiro${retirosMovs.length !== 1 ? "s" : ""}` },
                    { icon: DollarSign, color: "blue", label: "Ventas", value: String(numVentas), sub: "Transacciones hoy" },
                    { icon: Wallet, color: "purple", label: "Efectivo en Caja", value: fmtBs(saldoActual), sub: "Disponible", subColor: "emerald" },
                  ].map(({ icon: Icon, color, label, value, sub, subColor }) => (
                    <Card key={label} className="border-slate-200 shadow-sm">
                      <CardContent className="pt-5 pb-4 px-5">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-${color}-50`}>
                          <Icon className={`h-5 w-5 text-${color}-500`} />
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="text-xl font-bold text-slate-800">{value}</p>
                        <p className={`text-xs ${subColor ? `text-${subColor}-500` : "text-slate-400"}`}>{sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Tabla movimientos del día */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-700">Movimientos del Día</CardTitle>
                  <span className="text-xs text-slate-400">{movimientos.length} registros</span>
                </CardHeader>
                <TablaMovimientos movimientos={movimientos} />
              </Card>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: HISTORIAL
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "historial" && (
        <div className="space-y-4">

          {/* Filtros de fecha */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-600">Desde</Label>
              <Input type="date" className="mt-1 w-40 text-sm" value={histDesde}
                onChange={(e) => setHistDesde(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">Hasta</Label>
              <Input type="date" className="mt-1 w-40 text-sm" value={histHasta}
                onChange={(e) => setHistHasta(e.target.value)} />
            </div>
            <Button onClick={() => cargarHistorial(1)} size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Buscar
            </Button>
            {(histDesde || histHasta) && (
              <Button variant="outline" size="sm"
                onClick={() => { setHistDesde(""); setHistHasta(""); setTimeout(() => cargarHistorial(1), 0); }}>
                Limpiar
              </Button>
            )}
            <span className="text-xs text-slate-400 ml-auto">{histTotal} sesiones</span>
          </div>

          {/* Tabla historial */}
          <Card className="border-slate-200 shadow-sm">
            {histLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                Cargando historial…
              </div>
            ) : historial.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                No hay sesiones registradas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {["FECHA", "CAJERO", "S. INICIAL", "INGRESOS", "RETIROS", "VENTAS", "S. CALCULADO", "S. CONTADO", "DIF.", "ESTADO", ""].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historial.map((s) => {
                      const dif = parseFloat(s.diferencia ?? "0");
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            <span className="font-medium">{formatFechaCorta(s.abierta_en)}</span>
                            <br />
                            <span className="text-xs text-slate-400">{formatHora(s.abierta_en)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-700 truncate max-w-[120px]">{s.cajero_nombre ?? "—"}</p>
                            <p className="text-xs text-slate-400">{s.codigo}</p>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-700">{fmtBs(s.saldo_inicial)}</td>
                          <td className="px-4 py-3 tabular-nums font-medium text-emerald-600">+{fmtBs(s.total_ingresos)}</td>
                          <td className="px-4 py-3 tabular-nums font-medium text-red-600">-{fmtBs(s.total_retiros)}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{s.num_ventas}</td>
                          <td className="px-4 py-3 tabular-nums text-slate-700">
                            {s.saldo_esperado ? fmtBs(s.saldo_esperado) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-700">
                            {s.saldo_final ? fmtBs(s.saldo_final) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {s.diferencia != null ? (
                              <span className={`font-semibold tabular-nums text-xs ${
                                Math.abs(dif) < 0.01 ? "text-emerald-600" :
                                dif > 0 ? "text-blue-600" : "text-red-600"
                              }`}>
                                {dif >= 0 ? "+" : ""}{dif.toFixed(2)}
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3"><EstadoBadge estado={s.estado} /></td>
                          <td className="px-4 py-3">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
                              onClick={() => verDetalle(s.id)}>
                              <Eye className="h-3.5 w-3.5" /> Ver
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Paginación historial */}
          {histTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Página {histPage} de {histTotalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={histPage <= 1}
                  onClick={() => cargarHistorial(histPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={histPage >= histTotalPages}
                  onClick={() => cargarHistorial(histPage + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALES — CAJA DEL DÍA
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Abrir caja */}
      <Dialog open={modal === "abrir"} onOpenChange={closeModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-500" /> Abrir Caja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-600">Cajero / Responsable</Label>
              <Input className="mt-1" placeholder="Nombre del cajero"
                value={cajeroNombre} onChange={(e) => setCajeroNombre(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">
                Saldo Inicial <span className="text-red-500">*</span>
              </Label>
              <Input className="mt-1" type="number" min="0" step="0.01" placeholder="0.00"
                value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">Efectivo físico con el que inicia la caja.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleAbrir} disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? "Abriendo…" : "Abrir Caja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ingreso / Retiro */}
      <Dialog open={modal === "ingreso" || modal === "retiro"} onOpenChange={closeModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modal === "ingreso"
                ? <><ArrowUpRight className="h-5 w-5 text-emerald-500" /> Registrar Ingreso</>
                : <><ArrowDownLeft className="h-5 w-5 text-red-500" /> Registrar Retiro</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Monto */}
            <div>
              <Label className="text-xs font-semibold text-slate-600">
                Monto <span className="text-red-500">*</span>
              </Label>
              <Input className="mt-1 text-lg font-semibold" type="number" min="0.01" step="0.01"
                placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
            </div>
            {/* Método de pago */}
            <div>
              <Label className="text-xs font-semibold text-slate-600">Método de pago</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {([
                  ["efectivo",        "💵 Efectivo"],
                  ["tarjeta_credito", "💳 T. Crédito"],
                  ["tarjeta_debito",  "💳 T. Débito"],
                  ["transferencia",   "🏦 Transferencia"],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMetodoPago(val)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium text-left transition-colors ${
                      metodoPago === val
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Concepto */}
            <div>
              <Label className="text-xs font-semibold text-slate-600">
                Concepto <span className="text-red-500">*</span>
              </Label>
              <Input className="mt-1" placeholder="Descripción del movimiento"
                value={concepto} onChange={(e) => setConcepto(e.target.value)} />
            </div>
            {/* Notas */}
            <div>
              <Label className="text-xs font-semibold text-slate-600">
                Notas <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <Textarea className="mt-1 resize-none text-sm" rows={2} placeholder="Información adicional…"
                value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleMovimiento} disabled={saving || !monto || !concepto}
              className={modal === "ingreso" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}>
              {saving ? "Guardando…" : modal === "ingreso" ? "Registrar Ingreso" : "Registrar Retiro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cerrar caja */}
      <Dialog open={modal === "cerrar"} onOpenChange={closeModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-slate-700" /> Cerrar Caja
            </DialogTitle>
          </DialogHeader>
          {sesion && (
            <div className="space-y-4 py-1">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Arqueo — {sesion.codigo}
                </p>
                <div className="flex justify-between text-slate-600"><span>Saldo inicial</span><span className="font-medium">{fmtBs(sesion.saldo_inicial)}</span></div>
                <div className="flex justify-between text-emerald-600"><span>+ Ingresos del día</span><span className="font-medium">+{fmtBs(totalIngresos)}</span></div>
                <div className="flex justify-between text-red-600"><span>− Retiros</span><span className="font-medium">-{fmtBs(totalRetiros)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-800"><span>Saldo calculado</span><span>{fmtBs(saldoActual)}</span></div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Efectivo contado <span className="text-red-500">*</span>
                </Label>
                <Input className="mt-1 text-lg font-semibold" type="number" min="0" step="0.01"
                  placeholder={saldoActual.toFixed(2)} value={saldoContado}
                  onChange={(e) => setSaldoContado(e.target.value)} autoFocus />
              </div>
              {saldoContado !== "" && (
                <div className={`flex justify-between rounded-lg px-4 py-2.5 text-sm font-semibold ${
                  Math.abs(diferenciaCierre) < 0.01 ? "bg-emerald-50 text-emerald-700" :
                  diferenciaCierre > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                }`}>
                  <span>
                    Diferencia{Math.abs(diferenciaCierre) < 0.01 ? " ✓" : diferenciaCierre > 0 ? " (sobrante)" : " (faltante)"}
                  </span>
                  <span>{diferenciaCierre >= 0 ? "+" : ""}{diferenciaCierre.toFixed(2)}</span>
                </div>
              )}
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Notas de cierre <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Textarea className="mt-1 resize-none text-sm" rows={2} placeholder="Observaciones…"
                  value={notasCierre} onChange={(e) => setNotasCierre(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleCerrar} disabled={saving || !saldoContado}
              className="bg-slate-800 hover:bg-slate-900 text-white">
              {saving ? "Cerrando…" : "Confirmar Cierre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Detalle de sesión histórica ──────────────────────────────── */}
      <Dialog open={modalDetalle} onOpenChange={() => { setModalDetalle(false); setSesionDetalle(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {/* Header */}
          <div className="bg-indigo-600 text-white px-6 py-4 rounded-t-lg shrink-0">
            {detalleLoading || !sesionDetalle ? (
              <p className="text-indigo-200 text-sm">Cargando sesión…</p>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">
                    {sesionDetalle.codigo}
                    <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium capitalize">
                      {sesionDetalle.estado}
                    </span>
                  </h2>
                  <p className="text-indigo-200 text-sm mt-0.5">
                    {sesionDetalle.cajero_nombre ?? "Sin cajero"} ·
                    Apertura {formatFecha(sesionDetalle.abierta_en)} {formatHora(sesionDetalle.abierta_en)}
                    {sesionDetalle.cerrada_en && ` · Cierre ${formatHora(sesionDetalle.cerrada_en)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-indigo-200">Saldo final</p>
                  <p className="text-2xl font-extrabold">
                    {fmtBs(sesionDetalle.saldo_actual ?? sesionDetalle.saldo_final ?? sesionDetalle.saldo_inicial)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {sesionDetalle && !detalleLoading && (
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">

              {/* Arqueo resumido */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Saldo Inicial", value: fmtBs(sesionDetalle.saldo_inicial), cls: "text-slate-700" },
                  { label: "Ingresos", value: `+${fmtBs(detTotalIn)}`, cls: "text-emerald-600" },
                  { label: "Retiros", value: `-${fmtBs(detTotalRet)}`, cls: "text-red-600" },
                  { label: "Saldo Calculado", value: fmtBs(detSaldoCalc), cls: "text-slate-800 font-bold" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-base font-semibold mt-0.5 ${cls}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Si está cerrada: arqueo final con diferencia */}
              {sesionDetalle.estado === "cerrada" && sesionDetalle.saldo_final && (
                <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-xs text-slate-500">Saldo contado</p>
                    <p className="text-base font-semibold text-slate-800">{fmtBs(sesionDetalle.saldo_final)}</p>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-xs text-slate-500">Diferencia</p>
                    {(() => {
                      const dif = parseFloat(sesionDetalle.diferencia ?? "0");
                      return (
                        <p className={`text-base font-semibold ${
                          Math.abs(dif) < 0.01 ? "text-emerald-600" :
                          dif > 0 ? "text-blue-600" : "text-red-600"
                        }`}>
                          {dif >= 0 ? "+" : ""}{dif.toFixed(2)}
                          {Math.abs(dif) < 0.01 && " ✓"}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-xs text-slate-500">Ventas del día</p>
                    <p className="text-base font-semibold text-slate-800">{detVentas.length} transacciones</p>
                  </div>
                </div>
              )}

              {/* Métodos de pago */}
              {(sesionDetalle.metodos_pago ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Métodos de Pago
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sesionDetalle.metodos_pago.map((mp) => (
                      <div key={mp.metodo_pago} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <span className="font-medium capitalize text-slate-700">{mp.metodo_pago.replace(/_/g, " ")}</span>
                        <span className="ml-2 text-slate-500">{fmtBs(mp.total)}</span>
                        <span className="ml-1 text-xs text-slate-400">({mp.transacciones} trans.)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla de movimientos */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Movimientos ({detalleMovs.length})
                </p>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <TablaMovimientos movimientos={detalleMovs} />
                </div>
              </div>
            </div>
          )}

          {detalleLoading && (
            <div className="flex flex-1 items-center justify-center py-12 text-slate-400 text-sm">
              Cargando movimientos…
            </div>
          )}

          <div className="border-t border-slate-200 px-6 py-3 shrink-0 flex justify-end">
            <Button variant="outline" onClick={() => { setModalDetalle(false); setSesionDetalle(null); }}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
