import { Crown, Medal } from "lucide-react";
import { useEffect, useState } from "react";

import { reportesApi } from "@/modules/reportes/services/reportesApi";
import type { VendedorRanking } from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";

import { Velocimetro } from "./Velocimetro";

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

const PODIO_ICON = [
  { icon: Crown, className: "text-yellow-500" },
  { icon: Medal, className: "text-slate-400" },
  { icon: Medal, className: "text-orange-600" },
] as const;

function VendedorCard({ v, rank }: { v: VendedorRanking; rank: number }) {
  const podio = PODIO_ICON[rank - 1];
  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm relative">
      {podio && (
        <podio.icon className={`h-6 w-6 absolute -top-3 ${podio.className}`} fill="currentColor" />
      )}
      <div className="relative">
        {v.foto_url ? (
          <img src={v.foto_url} alt={v.nombre} className="h-16 w-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-lg font-bold border-2 border-slate-200 dark:border-slate-700">
            {iniciales(v.nombre)}
          </div>
        )}
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-extrabold">
          {rank}
        </span>
      </div>
      <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100 text-center truncate max-w-full" title={v.nombre}>
        {v.nombre}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Velocimetro value={v.pct_cantidad} label="Ventas" displayValue={String(v.cantidad_ventas)} hue="indigo" size={104} />
        <Velocimetro value={v.pct_monto} label="Monto" displayValue={fmtBs(v.monto_total)} hue="emerald" size={104} />
      </div>
    </div>
  );
}

/**
 * Ranking de vendedores del mes actual — velocímetros de cantidad de ventas
 * y monto vendido, relativos al mejor vendedor del período. Visible para
 * todos los roles (no solo admin) para fomentar competencia sana.
 */
export function RankingVendedores({ compact = false }: { compact?: boolean }) {
  const [vendedores, setVendedores] = useState<VendedorRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
    const hasta = hoy.toISOString().slice(0, 10);
    reportesApi.getRankingVendedores(desde, hasta)
      .then((r) => setVendedores(r.vendedores))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const lista = compact ? vendedores.slice(0, 3) : vendedores;

  if (loading) {
    return <div className="text-sm text-slate-400 py-6 text-center">Cargando ranking…</div>;
  }
  if (vendedores.length === 0) {
    return <div className="text-sm text-slate-400 py-6 text-center">Sin vendedores registrados.</div>;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
      {lista.map((v, i) => (
        <VendedorCard key={v.user_id} v={v} rank={i + 1} />
      ))}
    </div>
  );
}
