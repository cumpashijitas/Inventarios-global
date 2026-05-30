import {
  AlertTriangle,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Download,
  Package,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { reportesApi } from "@/modules/reportes/services/reportesApi";
import type {
  ReporteInventario,
  ReporteMovimiento,
  ReporteMovimientosPage,
  ReporteVentas,
} from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";

// ─── Constantes ───────────────────────────────────────────────────────────────
const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const hoy = () => new Date().toISOString().slice(0, 10);
const primerDia = (y: number, m: number) => `${y}-${pad(m)}-01`;
const ultimoDia = (y: number, m: number) => {
  const last = new Date(y, m, 0); // día 0 del mes siguiente = último del actual
  const today = new Date();
  return (last <= today ? last : today).toISOString().slice(0, 10);
};
const fmtFecha = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es", {
    day: "2-digit", month: "short", year: "numeric",
  });

// ─── Subcomponentes ───────────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
        <Icon className="h-4 w-4 text-indigo-600" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function StatCard({
  label, value, color = "slate",
}: { label: string; value: string; color?: "slate" | "green" | "orange" | "red" }) {
  const cls = {
    slate:  "text-slate-800",
    green:  "text-emerald-600",
    orange: "text-orange-500",
    red:    "text-red-600",
  }[color];
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, string> = {
    entrada:   "bg-emerald-100 text-emerald-700",
    salida:    "bg-red-100 text-red-700",
    ajuste:    "bg-yellow-100 text-yellow-700",
    devolucion:"bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[tipo] ?? "bg-slate-100 text-slate-600"}`}>
      {tipo}
    </span>
  );
}

// ─── Generador PDF ────────────────────────────────────────────────────────────
async function generarPDF(
  ventas: ReporteVentas,
  inv: ReporteInventario,
  movs: ReporteMovimiento[],
  desde: string,
  hasta: string,
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W    = doc.internal.pageSize.getWidth();
  const H    = doc.internal.pageSize.getHeight();
  const ML   = 14;
  const MR   = 14;
  const CW   = W - ML - MR;

  // ── Paleta ───────────────────────────────────────────────────────────────
  type RGB = [number, number, number];
  const C = {
    indigo:   [67,  56,  202] as RGB,
    indigoDk: [49,  46,  129] as RGB,
    indigoLt: [238, 242, 255] as RGB,
    emerald:  [16,  185, 129] as RGB,
    orange:   [234, 88,  12]  as RGB,
    red:      [220, 38,  38]  as RGB,
    s800:     [15,  23,  42]  as RGB,
    s600:     [71,  85,  105] as RGB,
    s400:     [148, 163, 184] as RGB,
    s100:     [241, 245, 249] as RGB,
    white:    [255, 255, 255] as RGB,
    rowAlt:   [248, 250, 252] as RGB,
  };

  let y = 0;
  const getLastY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Footer ────────────────────────────────────────────────────────────────
  const drawFooter = (page: number, total: number) => {
    const fy = H - 9;
    doc.setDrawColor(...C.s100);
    doc.setLineWidth(0.3);
    doc.line(ML, fy - 3, W - MR, fy - 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.s400);
    doc.text("Sistema de Inventario", ML, fy);
    doc.text(`Página ${page} de ${total}`, W / 2, fy, { align: "center" });
    doc.text(new Date().toLocaleDateString("es"), W - MR, fy, { align: "right" });
  };

  // ── Portada (banda superior) ──────────────────────────────────────────────
  const drawCover = () => {
    // Banda indigo
    doc.setFillColor(...C.indigo);
    doc.rect(0, 0, W, 34, "F");
    // Acento inferior oscuro
    doc.setFillColor(...C.indigoDk);
    doc.rect(0, 32, W, 2, "F");

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...C.white);
    doc.text("REPORTE DE NEGOCIOS", W / 2, 14, { align: "center" });

    // Período
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(195, 210, 255);
    doc.text(`${fmtFecha(desde)}  ·  ${fmtFecha(hasta)}`, W / 2, 22, { align: "center" });

    // Fecha generación (esquina derecha)
    doc.setFontSize(7);
    doc.setTextColor(160, 180, 240);
    doc.text(`Generado: ${new Date().toLocaleDateString("es")}`, W - MR, 29, { align: "right" });

    y = 42;
  };

  // ── Título de sección ─────────────────────────────────────────────────────
  const sectionHead = (titulo: string, sub?: string) => {
    if (y > H - 55) { doc.addPage(); y = 18; }
    // Fondo tenue
    doc.setFillColor(...C.indigoLt);
    doc.rect(ML, y, CW, 10, "F");
    // Barra izquierda
    doc.setFillColor(...C.indigo);
    doc.rect(ML, y, 3.5, 10, "F");
    // Texto título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.indigo);
    doc.text(titulo, ML + 7, y + 6.8);
    // Subtítulo derecha
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.s400);
      doc.text(sub, W - MR, y + 6.8, { align: "right" });
    }
    doc.setTextColor(...C.s800);
    y += 14;
  };

  // ── Grid de KPI cards ─────────────────────────────────────────────────────
  type KpiItem = { label: string; value: string; color?: RGB };
  const kpiGrid = (items: KpiItem[]) => {
    const cols = 3;
    const gap  = 4;
    const cardW = (CW - gap * (cols - 1)) / cols;
    const cardH = 19;
    const rows  = Math.ceil(items.length / cols);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const item = items[r * cols + c];
        if (!item) continue;
        const cx = ML + c * (cardW + gap);
        const cy = y  + r * (cardH + 3);

        // Fondo de la card
        doc.setFillColor(...C.s100);
        doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, "F");
        // Acento superior
        doc.setFillColor(...C.indigo);
        doc.roundedRect(cx, cy, cardW, 2.2, 0.8, 0.8, "F");

        // Label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...C.s400);
        doc.text(item.label.toUpperCase(), cx + 3.5, cy + 8);

        // Valor
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(...(item.color ?? C.s800));
        doc.text(item.value, cx + 3.5, cy + 15.5);
      }
    }
    y += rows * (cardH + 3) + 7;
  };

  // ── Estilos de tablas ─────────────────────────────────────────────────────
  const tHead = { fillColor: C.indigo, textColor: C.white, fontStyle: "bold" as const, fontSize: 8, cellPadding: 3 };
  const tFoot = { fillColor: C.indigoDk, textColor: C.white, fontStyle: "bold" as const, fontSize: 8 };
  const tBody = { fontSize: 7.5, cellPadding: 2.5, textColor: C.s800 };
  const tAlt  = { fillColor: C.rowAlt };
  const tLine = { tableLineColor: C.s100, tableLineWidth: 0.1 };

  // ==========================================================================
  drawCover();

  // ── 1. Resumen de Ventas ──────────────────────────────────────────────────
  const rv = ventas.resumen;
  sectionHead("1.  RESUMEN DE VENTAS", `${fmtFecha(desde)} — ${fmtFecha(hasta)}`);
  kpiGrid([
    { label: "Ingresos Totales",  value: fmtBs(rv.ingresos_totales) },
    { label: "Costo Total",        value: fmtBs(rv.costo_total) },
    { label: "Ganancia Bruta",     value: fmtBs(rv.ganancia_bruta),   color: C.emerald },
    {
      label: "Margen",
      value: `${rv.margen.toFixed(1)}%`,
      color: rv.margen >= 20 ? C.emerald : rv.margen >= 10 ? C.s800 : C.orange,
    },
    { label: "Transacciones",      value: String(rv.transacciones) },
    { label: "Ticket Promedio",    value: fmtBs(rv.ticket_promedio) },
  ]);

  // ── 2. Top Productos ──────────────────────────────────────────────────────
  if (ventas.top_productos.length > 0) {
    sectionHead("2.  TOP PRODUCTOS DEL PERÍODO");
    autoTable(doc, {
      startY: y,
      head: [["#", "SKU", "Producto", "Cant. Vendida", "Total Vendido"]],
      body: ventas.top_productos.map((p, i) => [
        String(i + 1), p.sku, p.nombre,
        Number(p.cantidad_vendida).toFixed(0),
        fmtBs(p.total_vendido),
      ]),
      styles: tBody, headStyles: tHead, alternateRowStyles: tAlt,
      margin: { left: ML, right: MR },
      columnStyles: {
        0: { cellWidth: 8,  halign: "center" },
        3: { cellWidth: 30, halign: "right"  },
        4: { cellWidth: 34, halign: "right"  },
      },
      ...tLine,
    });
    y = getLastY() + 10;
  }

  // ── 3. Ventas Diarias ─────────────────────────────────────────────────────
  if (ventas.ventas_por_dia.length > 0) {
    sectionHead("3.  VENTAS DIARIAS");
    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Transacciones", "Total (Bs)", "Ticket Prom. (Bs)"]],
      body: ventas.ventas_por_dia.map(d => [
        fmtFecha(d.fecha),
        String(d.transacciones),
        fmtBs(d.total),
        fmtBs(d.transacciones > 0 ? d.total / d.transacciones : 0),
      ]),
      foot: [["TOTAL", String(rv.transacciones), fmtBs(rv.ingresos_totales), fmtBs(rv.ticket_promedio)]],
      styles: tBody, headStyles: tHead, alternateRowStyles: tAlt, footStyles: tFoot,
      showFoot: "lastPage",
      margin: { left: ML, right: MR },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
      ...tLine,
    });
    y = getLastY() + 10;
  }

  // ── 4. Resumen de Inventario ──────────────────────────────────────────────
  const ri = inv.resumen;
  sectionHead("4.  RESUMEN DE INVENTARIO", "estado actual del stock");
  kpiGrid([
    { label: "Total Productos",  value: String(ri.total_productos) },
    { label: "Valor del Stock",   value: fmtBs(ri.valor_total) },
    { label: "Stock Bajo",        value: String(ri.stock_bajo),  color: ri.stock_bajo > 0 ? C.orange : C.emerald },
    { label: "Sin Stock",         value: String(ri.sin_stock),   color: ri.sin_stock  > 0 ? C.red    : C.emerald },
    { label: "Categorías",        value: String(ri.categorias) },
    { label: "Proveedores",       value: String(ri.proveedores) },
  ]);

  // ── 5. Movimientos de Inventario ──────────────────────────────────────────
  if (movs.length > 0) {
    sectionHead("5.  MOVIMIENTOS DE INVENTARIO", `${movs.length} registros`);
    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Tipo", "SKU", "Producto", "Almacén", "Cant.", "Valor (Bs)"]],
      body: movs.map(m => [
        new Date(m.created_at).toLocaleDateString("es"),
        m.tipo, m.sku, m.producto_nombre,
        m.almacen_nombre ?? "—",
        Number(m.cantidad).toFixed(0),
        fmtBs(m.costo_unitario * m.cantidad),
      ]),
      styles: { ...tBody, fontSize: 7 }, headStyles: tHead, alternateRowStyles: tAlt,
      margin: { left: ML, right: MR },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 19 },
        2: { cellWidth: 22 },
        5: { cellWidth: 14, halign: "right" },
        6: { cellWidth: 26, halign: "right" },
      },
      ...tLine,
    });
  }

  // ── Footer en todas las páginas ───────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  doc.save(`reporte_${desde}_${hasta}.pdf`);
}

// =============================================================================
// PÁGINA PRINCIPAL
// =============================================================================
export default function ReportesPage() {
  const today = new Date();

  // ── Navegador de período ──────────────────────────────────────────────────
  const [navYear,  setNavYear]  = useState(today.getFullYear());
  const [navMonth, setNavMonth] = useState(today.getMonth() + 1);
  const [customMode, setCustomMode] = useState(false);
  const [customDesde, setCustomDesde] = useState(primerDia(today.getFullYear(), today.getMonth() + 1));
  const [customHasta, setCustomHasta] = useState(hoy());

  const desde = customMode ? customDesde : primerDia(navYear, navMonth);
  const hasta = customMode ? customHasta : ultimoDia(navYear, navMonth);

  const isFuturo = (y: number, m: number) =>
    y > today.getFullYear() || (y === today.getFullYear() && m > today.getMonth() + 1);

  const prevMes = () => {
    if (navMonth === 1) { setNavYear(y => y - 1); setNavMonth(12); }
    else setNavMonth(m => m - 1);
  };
  const nextMes = () => {
    if (isFuturo(navYear, navMonth)) return;
    if (navMonth === 12) { setNavYear(y => y + 1); setNavMonth(1); }
    else setNavMonth(m => m + 1);
  };

  // ── Datos de ventas ───────────────────────────────────────────────────────
  const [reporteVentas, setReporteVentas] = useState<ReporteVentas | null>(null);
  const [loadingVentas, setLoadingVentas] = useState(false);

  const cargarVentas = async (d = desde, h = hasta) => {
    setLoadingVentas(true);
    try {
      setReporteVentas(await reportesApi.getVentas(d, h));
    } catch (err) { console.error(err); }
    finally { setLoadingVentas(false); }
  };

  useEffect(() => { cargarVentas(); }, [desde, hasta]); // eslint-disable-line

  // ── Datos de inventario (solo una vez) ───────────────────────────────────
  const [reporteInv, setReporteInv] = useState<ReporteInventario | null>(null);
  useEffect(() => {
    reportesApi.getInventario().then(setReporteInv).catch(console.error);
  }, []);

  // ── Movimientos (fechas y paginación independientes) ─────────────────────
  const [movDesde,    setMovDesde]    = useState(primerDia(today.getFullYear(), today.getMonth() + 1));
  const [movHasta,    setMovHasta]    = useState(hoy());
  const [movPage,     setMovPage]     = useState(1);
  const [movData,     setMovData]     = useState<ReporteMovimientosPage | null>(null);
  const [loadingMovs, setLoadingMovs] = useState(false);

  const cargarMovs = async (page = movPage) => {
    setLoadingMovs(true);
    try {
      setMovData(await reportesApi.getMovimientos(movDesde, movHasta, page));
      setMovPage(page);
    } catch (err) { console.error(err); }
    finally { setLoadingMovs(false); }
  };

  useEffect(() => { cargarMovs(1); }, [movDesde, movHasta]); // eslint-disable-line

  // ── Export modal ─────────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormato, setExportFormato] = useState<"pdf" | "csv">("pdf");
  const [exportDesde, setExportDesde] = useState(desde);
  const [exportHasta, setExportHasta] = useState(hasta);
  const [generando, setGenerando] = useState(false);
  const exportBtnRef = useRef<HTMLButtonElement>(null);

  // Sincronizar dates del modal cuando abre
  const abrirExport = () => {
    setExportDesde(desde);
    setExportHasta(hasta);
    setExportOpen(true);
  };

  const handleDescargar = async () => {
    if (!reporteVentas || !reporteInv) return;
    setGenerando(true);
    try {
      const movs = await reportesApi.getAllMovimientos(exportDesde, exportHasta);

      if (exportFormato === "pdf") {
        await generarPDF(reporteVentas, reporteInv, movs, exportDesde, exportHasta);
      } else {
        // CSV completo multi-sección (sep=; para Excel en español)
        const esc = (v: unknown) => {
          const s = String(v ?? "");
          return s.includes(";") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const row = (...cols: unknown[]) => cols.map(esc).join(";");
        const sep = () => "";

        const rv2 = reporteVentas;
        const ri2 = reporteInv;

        const lines: string[] = [
          // ── Encabezado ──
          row("REPORTE DE NEGOCIOS"),
          row(`Período: ${exportDesde} — ${exportHasta}`),
          row(`Generado: ${new Date().toLocaleDateString("es")}`),
          sep(),

          // ── 1. Resumen de Ventas ──
          row("=== RESUMEN DE VENTAS ==="),
          row("Indicador", "Valor"),
          row("Ingresos Totales",  rv2.resumen.ingresos_totales.toFixed(2)),
          row("Costo Total",        rv2.resumen.costo_total.toFixed(2)),
          row("Ganancia Bruta",     rv2.resumen.ganancia_bruta.toFixed(2)),
          row("Margen (%)",         rv2.resumen.margen.toFixed(2)),
          row("Transacciones",      rv2.resumen.transacciones),
          row("Ticket Promedio",    rv2.resumen.ticket_promedio.toFixed(2)),
          sep(),

          // ── 2. Ventas Diarias ──
          row("=== VENTAS DIARIAS ==="),
          row("Fecha", "Transacciones", "Total", "Ticket Promedio"),
          ...rv2.ventas_por_dia.map(d =>
            row(d.fecha, d.transacciones, d.total,
              d.transacciones > 0 ? (d.total / d.transacciones).toFixed(2) : "0.00")
          ),
          sep(),

          // ── 3. Top Productos ──
          row("=== TOP PRODUCTOS ==="),
          row("SKU", "Nombre", "Cantidad Vendida", "Total Vendido"),
          ...rv2.top_productos.map(p =>
            row(p.sku, p.nombre, Number(p.cantidad_vendida).toFixed(0), Number(p.total_vendido).toFixed(2))
          ),
          sep(),

          // ── 4. Resumen Inventario ──
          row("=== RESUMEN DE INVENTARIO ==="),
          row("Indicador", "Valor"),
          row("Total Productos",  ri2.resumen.total_productos),
          row("Valor Total (Bs)", ri2.resumen.valor_total.toFixed(2)),
          row("Stock Bajo",       ri2.resumen.stock_bajo),
          row("Sin Stock",        ri2.resumen.sin_stock),
          row("Categorías",       ri2.resumen.categorias),
          row("Proveedores",      ri2.resumen.proveedores),
          sep(),

          // ── 5. Movimientos de Inventario ──
          row("=== MOVIMIENTOS DE INVENTARIO ==="),
          row("Fecha", "Tipo", "SKU", "Producto", "Almacén", "Cantidad", "Costo Unitario", "Valor Total", "Motivo"),
          ...movs.map(m =>
            row(
              new Date(m.created_at).toLocaleDateString("es"),
              m.tipo, m.sku, m.producto_nombre,
              m.almacen_nombre ?? "",
              Number(m.cantidad).toFixed(0),
              Number(m.costo_unitario).toFixed(2),
              (m.costo_unitario * m.cantidad).toFixed(2),
              m.motivo ?? "",
            )
          ),
        ];

        const csv = "﻿sep=;\r\n" + lines.join("\r\n"); // BOM + hint sep para Excel español
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reporte_${exportDesde}_${exportHasta}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setExportOpen(false);
    } catch (err) { console.error(err); }
    finally { setGenerando(false); }
  };

  const rv = reporteVentas;
  const ri = reporteInv;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reportes</h1>
          <p className="text-sm text-slate-500">Estadísticas y movimientos del negocio</p>
        </div>

        {/* Botón exportar */}
        <div className="relative">
          <Button
            ref={exportBtnRef}
            onClick={abrirExport}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          >
            <Download className="h-4 w-4" /> Exportar Reporte
          </Button>

          {/* Modal de exportación (dropdown flotante) */}
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-11 z-40 w-72 rounded-xl border border-slate-200 bg-white shadow-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Configurar exportación</h3>
                  <button onClick={() => setExportOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Desde</Label>
                    <Input type="date" className="mt-1 text-sm" value={exportDesde}
                      onChange={e => setExportDesde(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Hasta</Label>
                    <Input type="date" className="mt-1 text-sm" value={exportHasta}
                      onChange={e => setExportHasta(e.target.value)} />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Formato</Label>
                    <div className="mt-1.5 flex gap-2">
                      {([ ["pdf", "📄 PDF"], ["csv", "📊 CSV"] ] as const).map(([fmt, label]) => (
                        <button key={fmt} type="button"
                          onClick={() => setExportFormato(fmt)}
                          className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                            exportFormato === fmt
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setExportOpen(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" disabled={generando || !rv || !ri}
                    onClick={handleDescargar}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                    {generando
                      ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generando…</>
                      : <><Download className="h-3.5 w-3.5" /> Descargar</>}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Navegador de período ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        {/* Modo mes */}
        {!customMode && (
          <div className="flex items-center gap-1">
            <button onClick={prevMes}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-slate-800">
              {MESES[navMonth - 1]} {navYear}
            </span>
            <button onClick={nextMes} disabled={isFuturo(navYear, navMonth)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40">
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        )}

        {/* Modo personalizado */}
        {customMode && (
          <div className="flex items-center gap-2">
            <Input type="date" className="h-8 w-36 text-xs" value={customDesde}
              onChange={e => setCustomDesde(e.target.value)} />
            <span className="text-xs text-slate-400">→</span>
            <Input type="date" className="h-8 w-36 text-xs" value={customHasta}
              onChange={e => setCustomHasta(e.target.value)} />
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setCustomMode(m => !m)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              customMode
                ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            Rango personalizado
          </button>
          <Button onClick={() => cargarVentas()} disabled={loadingVentas}
            variant="outline" size="sm" className="h-8 px-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingVentas ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Indicador del rango activo */}
        <div className="w-full -mt-1">
          <p className="text-xs text-slate-400">
            {desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} — ${fmtFecha(hasta)}`}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BLOQUE 1 — Resumen de Ventas
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <SectionTitle
              icon={TrendingUp}
              title={`Resumen de Ventas — ${MESES[navMonth - 1]} ${navYear}`}
              sub={customMode ? `${desde} → ${hasta}` : undefined}
            />
            {loadingVentas && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {rv ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Ingresos Totales"  value={fmtBs(rv.resumen.ingresos_totales)} />
              <StatCard label="Costo Total"        value={fmtBs(rv.resumen.costo_total)} />
              <StatCard label="Ganancia Bruta"     value={fmtBs(rv.resumen.ganancia_bruta)} color="green" />
              <StatCard
                label="Margen"
                value={`${rv.resumen.margen.toFixed(1)}%`}
                color={rv.resumen.margen >= 20 ? "green" : rv.resumen.margen >= 10 ? "slate" : "red"}
              />
              <StatCard label="Transacciones"      value={String(rv.resumen.transacciones)} />
              <StatCard label="Ticket Promedio"    value={fmtBs(rv.resumen.ticket_promedio)} />
            </div>
          ) : (
            <p className="text-xs text-slate-400">{loadingVentas ? "Cargando…" : "Sin datos para el período"}</p>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          BLOQUE 2 — Ventas Diarias + Top Productos (lado a lado si hay espacio)
      ══════════════════════════════════════════════════════════════════════ */}
      {rv && (
        <div className="grid gap-5 lg:grid-cols-5">

          {/* Ventas por día */}
          <Card className="border-slate-200 shadow-sm lg:col-span-3">
            <CardHeader className="pb-2 pt-4 px-5">
              <SectionTitle icon={BarChart2} title="Ventas Diarias" sub="del período seleccionado" />
            </CardHeader>
            {rv.ventas_por_dia.length === 0 ? (
              <div className="px-5 pb-5 text-xs text-slate-400">Sin ventas en este período.</div>
            ) : (
              <div className="overflow-auto max-h-72">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {["FECHA", "VENTAS", "TOTAL", "TICKET PROM."].map(h => (
                        <th key={h} className="px-5 py-2 text-left text-[11px] font-semibold tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rv.ventas_por_dia.map(d => (
                      <tr key={d.fecha} className="hover:bg-slate-50/60">
                        <td className="px-5 py-2.5 text-slate-600 text-xs font-mono">{fmtFecha(d.fecha)}</td>
                        <td className="px-5 py-2.5 text-slate-700">{d.transacciones}</td>
                        <td className="px-5 py-2.5 font-semibold text-slate-800 tabular-nums">{fmtBs(d.total)}</td>
                        <td className="px-5 py-2.5 text-slate-500 tabular-nums">
                          {fmtBs(d.transacciones > 0 ? d.total / d.transacciones : 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-600">TOTAL</td>
                      <td className="px-5 py-2.5 font-semibold text-slate-700">{rv.resumen.transacciones}</td>
                      <td className="px-5 py-2.5 font-bold text-indigo-700 tabular-nums">{fmtBs(rv.resumen.ingresos_totales)}</td>
                      <td className="px-5 py-2.5 font-semibold text-slate-700 tabular-nums">{fmtBs(rv.resumen.ticket_promedio)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {/* Top productos */}
          <Card className="border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader className="pb-2 pt-4 px-5">
              <SectionTitle icon={Package} title="Top 10 Productos" sub="por ingresos" />
            </CardHeader>
            {rv.top_productos.length === 0 ? (
              <div className="px-5 pb-5 text-xs text-slate-400">Sin ventas en este período.</div>
            ) : (
              <div className="overflow-auto max-h-72 divide-y divide-slate-100 px-5 pb-4">
                {rv.top_productos.map((p, i) => (
                  <div key={p.sku} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-700">{p.nombre}</p>
                      <p className="text-[11px] text-slate-400">{p.sku} · {Number(p.cantidad_vendida).toFixed(0)} uds</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-800 tabular-nums">
                      {fmtBs(p.total_vendido)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          BLOQUE 3 — Resumen de Inventario
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <SectionTitle icon={Package} title="Resumen de Inventario" sub="estado actual del stock" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {ri ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Total Productos" value={String(ri.resumen.total_productos)} />
              <StatCard label="Valor Total"      value={fmtBs(ri.resumen.valor_total)} />
              <StatCard
                label="Stock Bajo"
                value={String(ri.resumen.stock_bajo)}
                color={ri.resumen.stock_bajo > 0 ? "orange" : "slate"}
              />
              <StatCard
                label="Sin Stock"
                value={String(ri.resumen.sin_stock)}
                color={ri.resumen.sin_stock > 0 ? "red" : "slate"}
              />
              <StatCard label="Categorías"  value={String(ri.resumen.categorias)} />
              <StatCard label="Proveedores" value={String(ri.resumen.proveedores)} />
            </div>
          ) : (
            <p className="text-xs text-slate-400">Cargando inventario…</p>
          )}
          {ri && (ri.resumen.stock_bajo > 0 || ri.resumen.sin_stock > 0) && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-4 py-2.5 text-xs text-orange-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {ri.resumen.sin_stock > 0
                ? `${ri.resumen.sin_stock} producto${ri.resumen.sin_stock > 1 ? "s" : ""} sin stock y ${ri.resumen.stock_bajo} en nivel mínimo — revisa tu inventario.`
                : `${ri.resumen.stock_bajo} producto${ri.resumen.stock_bajo > 1 ? "s" : ""} en nivel de stock mínimo.`
              }
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          BLOQUE 4 — Movimientos de Inventario
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          {/* Header con filtro de fechas propio */}
          <div className="flex flex-wrap items-center gap-3">
            <SectionTitle icon={BarChart2} title="Movimientos de Inventario" />
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <span className="text-xs text-slate-400">Desde</span>
              <Input type="date" className="h-7 w-34 text-xs" value={movDesde}
                onChange={e => setMovDesde(e.target.value)} />
              <span className="text-xs text-slate-400">Hasta</span>
              <Input type="date" className="h-7 w-34 text-xs" value={movHasta}
                onChange={e => setMovHasta(e.target.value)} />
              <Button onClick={() => cargarMovs(1)} disabled={loadingMovs}
                variant="outline" size="sm" className="h-7 px-2">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingMovs ? "animate-spin" : ""}`} />
              </Button>
              {movData && (
                <span className="text-xs text-slate-400">{movData.total} registros</span>
              )}
            </div>
          </div>
        </CardHeader>

        {loadingMovs ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">
            Cargando movimientos…
          </div>
        ) : !movData || movData.items.length === 0 ? (
          <div className="px-5 pb-5 text-xs text-slate-400">Sin movimientos en el período seleccionado.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["FECHA", "TIPO", "SKU", "PRODUCTO", "ALMACÉN", "CANTIDAD", "VALOR"].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movData.items.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">
                        {new Date(m.created_at).toLocaleDateString("es")}
                      </td>
                      <td className="px-5 py-3"><TipoBadge tipo={m.tipo} /></td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">{m.sku}</td>
                      <td className="px-5 py-3 max-w-[200px] truncate text-slate-700">{m.producto_nombre}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{m.almacen_nombre ?? "—"}</td>
                      <td className="px-5 py-3 tabular-nums font-medium text-slate-700">
                        {Number(m.cantidad).toFixed(0)} uds
                      </td>
                      <td className="px-5 py-3 tabular-nums font-semibold text-slate-800">
                        {fmtBs(m.costo_unitario * m.cantidad)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {movData.total_pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <span className="text-xs text-slate-500">
                  Página {movData.page} de {movData.total_pages} · {movData.total} registros
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={movPage <= 1}
                    onClick={() => cargarMovs(movPage - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={movPage >= movData.total_pages}
                    onClick={() => cargarMovs(movPage + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
