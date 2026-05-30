import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Box,
  FileText,
  Lock,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
  Unlock,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { dashboardApi } from "@/modules/dashboard/services/dashboardApi";
import { adminApi } from "@/modules/administracion/services/adminApi";
import { api } from "@/shared/api/client";
import type { ActividadItem, DashboardStats } from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";
import { useAuthStore } from "@/shared/stores/auth.store";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} día${d > 1 ? "s" : ""}`;
}

const CAT_COLORS = ["#4338ca", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"];

// ─── Mapa de íconos por tipo de actividad ─────────────────────────────────────
type IconDef = {
  icon: React.ElementType;
  bg: string;
  color: string;
};

const ACTIVITY_ICONS: Record<string, IconDef> = {
  "venta.crear":                { icon: ShoppingCart, bg: "bg-blue-100",    color: "text-blue-600"    },
  "venta.anular":               { icon: X,            bg: "bg-red-100",     color: "text-red-600"     },
  "cotizacion.crear":           { icon: FileText,     bg: "bg-purple-100",  color: "text-purple-600"  },
  "cotizacion.cambiar_estado":  { icon: FileText,     bg: "bg-purple-50",   color: "text-purple-500"  },
  "sesion.abrir":               { icon: Unlock,       bg: "bg-emerald-100", color: "text-emerald-600" },
  "sesion.cerrar":              { icon: Lock,         bg: "bg-slate-100",   color: "text-slate-500"   },
  "movimiento.ingreso":         { icon: ArrowDownLeft,bg: "bg-emerald-100", color: "text-emerald-600" },
  "movimiento.retiro":          { icon: ArrowUpRight, bg: "bg-orange-100",  color: "text-orange-600"  },
  "movimiento.venta":           { icon: ShoppingCart, bg: "bg-blue-50",     color: "text-blue-500"    },
  "cliente.crear":              { icon: UserPlus,     bg: "bg-teal-100",    color: "text-teal-600"    },
  "cliente.actualizar":         { icon: UserPlus,     bg: "bg-teal-50",     color: "text-teal-500"    },
  "proveedor.crear":            { icon: Truck,        bg: "bg-indigo-100",  color: "text-indigo-600"  },
  "proveedor.actualizar":       { icon: Truck,        bg: "bg-indigo-50",   color: "text-indigo-500"  },
  "movimiento_stock.entrada":   { icon: ArrowDownLeft,bg: "bg-green-100",   color: "text-green-600"   },
  "movimiento_stock.salida":    { icon: ArrowUpRight, bg: "bg-red-100",     color: "text-red-600"     },
  "movimiento_stock.ajuste":    { icon: RefreshCw,    bg: "bg-yellow-100",  color: "text-yellow-600"  },
  "producto.crear":             { icon: Box,          bg: "bg-sky-100",     color: "text-sky-600"     },
  "producto.actualizar":        { icon: Box,          bg: "bg-sky-50",      color: "text-sky-500"     },
  "producto.eliminar":          { icon: X,            bg: "bg-red-50",      color: "text-red-500"     },
};

const FALLBACK_ICON: IconDef = { icon: Package, bg: "bg-slate-100", color: "text-slate-500" };

function getIconDef(tipo: string): IconDef {
  return ACTIVITY_ICONS[tipo] ?? FALLBACK_ICON;
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  badge,
  badgeColor,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="mt-3">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-800">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Bar chart de ventas ───────────────────────────────────────────────────────
function BarChart({ data }: { data: DashboardStats["ventas_semana"] }) {
  const maxV = Math.max(...data.map((d) => d.total), 1);
  const todayIso = new Date().toISOString().slice(0, 10);

  if (data.every((d) => d.total === 0)) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-slate-400">
        Sin ventas esta semana
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex h-44 items-end gap-2">
        {data.map((d) => {
          const pct = Math.round((d.total / maxV) * 100);
          const isToday = d.fecha === todayIso;
          const minH = d.total > 0 ? 8 : 2;
          const barH = Math.max(Math.round((pct / 100) * 160), minH);

          return (
            <div key={d.dia} className="group flex flex-1 flex-col items-center gap-1">
              {/* Valor encima de la barra */}
              <div className="relative flex flex-col items-center">
                {d.total > 0 && (
                  <span
                    className={`mb-1 hidden text-[10px] font-semibold tabular-nums group-hover:block ${
                      isToday ? "text-indigo-700" : "text-slate-500"
                    }`}
                  >
                    {fmtBs(d.total)}
                  </span>
                )}
              </div>
              {/* Barra */}
              <div
                className={`w-full rounded-t-md transition-all ${
                  isToday
                    ? "bg-indigo-600 group-hover:bg-indigo-500"
                    : "bg-indigo-300 group-hover:bg-indigo-400"
                }`}
                style={{ height: `${barH}px` }}
                title={`${d.dia}: ${fmtBs(d.total)}`}
              />
            </div>
          );
        })}
      </div>
      {/* Etiquetas de días */}
      <div className="flex gap-2">
        {data.map((d) => {
          const isToday = d.fecha === todayIso;
          return (
            <div key={d.dia} className="flex flex-1 justify-center">
              <span
                className={`text-[11px] font-medium ${
                  isToday ? "text-indigo-700 font-bold" : "text-slate-400"
                }`}
              >
                {d.dia}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Feed de actividad ────────────────────────────────────────────────────────
function ActividadFeed({ items }: { items: ActividadItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-slate-400">
        Sin actividad reciente registrada
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {items.map((a) => {
        const { icon: Icon, bg, color } = getIconDef(a.tipo);
        return (
          <div key={a.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
            {/* Ícono */}
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>

            {/* Contenido */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 leading-snug">
                {a.titulo}
              </p>
              {a.descripcion && (
                <p className="mt-0.5 truncate text-xs text-slate-500">{a.descripcion}</p>
              )}
              {/* Usuario + tiempo */}
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {a.usuario_nombre}
                </span>
                <span className="text-[10px] text-slate-400">{timeAgo(a.created_at)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// PÁGINA PRINCIPAL
// =============================================================================
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertasStockActivas, setAlertasStockActivas] = useState(true);
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [reporteMsg, setReporteMsg] = useState<string | null>(null);
  const rol = useAuthStore((s) => s.rol);
  const esAdmin = rol === "admin";

  const cargar = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [statsData, sistemaData] = await Promise.all([
        dashboardApi.getStats(),
        adminApi.getSistema().catch(() => null),   // no falla si hay error de permisos
      ]);
      setStats(statsData);
      if (sistemaData) setAlertasStockActivas(sistemaData.alertas_stock_bajo);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleEnviarReporte = async () => {
    setEnviandoReporte(true);
    setReporteMsg(null);
    try {
      const r = await api.post<{ enviado: boolean; motivo?: string; productos?: number; email_destino?: string }>(
        "/admin/notificaciones/stock-bajo"
      );
      if (r.data.enviado) {
        setReporteMsg(`✓ Reporte enviado a ${r.data.email_destino} · ${r.data.productos} producto${r.data.productos !== 1 ? "s" : ""}`);
      } else {
        setReporteMsg(`ℹ ${r.data.motivo}`);
      }
    } catch {
      setReporteMsg("✗ Error al enviar el reporte");
    } finally {
      setEnviandoReporte(false);
      setTimeout(() => setReporteMsg(null), 6000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
        Cargando estadísticas…
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
        No se pudieron cargar las estadísticas.
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Resumen del negocio en tiempo real</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón reporte stock — solo admin */}
          {esAdmin && alertasStockActivas && (
            <button
              onClick={handleEnviarReporte}
              disabled={enviandoReporte}
              className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
            >
              <AlertTriangle className={`h-3.5 w-3.5 ${enviandoReporte ? "animate-pulse" : ""}`} />
              {enviandoReporte ? "Enviando…" : "Enviar reporte de stock"}
            </button>
          )}
          <button
            onClick={() => cargar(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Feedback del reporte enviado */}
      {reporteMsg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
          reporteMsg.startsWith("✓")
            ? "bg-green-50 text-green-700 border border-green-200"
            : reporteMsg.startsWith("✗")
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {reporteMsg}
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingCart} iconBg="bg-blue-50" iconColor="text-blue-500"
          label="Ventas del Día" value={fmtBs(stats.ventas_hoy)}
          badge="↑ hoy" badgeColor="bg-green-100 text-green-700"
        />
        <StatCard
          icon={ShoppingCart} iconBg="bg-indigo-50" iconColor="text-indigo-500"
          label="Órdenes Hoy" value={String(stats.ordenes_hoy)}
          badge={stats.ordenes_hoy > 0 ? "↑" : "—"} badgeColor="bg-green-100 text-green-700"
        />
        <StatCard
          icon={Package} iconBg="bg-purple-50" iconColor="text-purple-500"
          label="Total Productos" value={String(stats.total_productos)}
        />
        {alertasStockActivas ? (
          <StatCard
            icon={AlertTriangle}
            iconBg={stats.stock_bajo > 0 ? "bg-orange-50" : "bg-slate-50"}
            iconColor={stats.stock_bajo > 0 ? "text-orange-500" : "text-slate-400"}
            label="Stock Bajo"
            value={String(stats.stock_bajo)}
            badge={stats.stock_bajo > 0 ? "Atención" : undefined}
            badgeColor="bg-orange-100 text-orange-700"
          />
        ) : (
          <StatCard
            icon={AlertTriangle}
            iconBg="bg-slate-50"
            iconColor="text-slate-300"
            label="Stock Bajo"
            value="—"
            badge="Alertas desactivadas"
            badgeColor="bg-slate-100 text-slate-400"
          />
        )}
      </div>

      {/* ── Gráfico + Categorías ────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* Ventas de la semana */}
        <Card className="border-slate-200 shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-5">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700">
                Ventas de la Semana
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Lun – Sáb (semana actual)</p>
            </div>
            <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              {fmtBs(stats.ventas_semana.reduce((s, d) => s + d.total, 0))}
            </span>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <BarChart data={stats.ventas_semana} />
          </CardContent>
        </Card>

        {/* Distribución por categoría */}
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-slate-700">
              Por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            {stats.categorias.length === 0 ? (
              <p className="text-xs text-slate-400">Sin categorías registradas</p>
            ) : (() => {
              const total = stats.categorias.reduce((s, c) => s + c.cantidad, 0) || 1;
              return stats.categorias.slice(0, 6).map((c, i) => {
                const pct = Math.round((c.cantidad / total) * 100);
                return (
                  <div key={c.nombre}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-600 truncate max-w-[120px]">{c.nombre}</span>
                      <span className="font-semibold text-slate-700 ml-2">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>
      </div>

      {/* ── Actividad reciente ─────────────────────────────────────────────── */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700">
                Actividad Reciente
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Últimas acciones del sistema</p>
            </div>
            {stats.actividad_reciente.length > 0 && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                {stats.actividad_reciente.length} registros
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <ActividadFeed items={stats.actividad_reciente} />
        </CardContent>
      </Card>

    </div>
  );
}
