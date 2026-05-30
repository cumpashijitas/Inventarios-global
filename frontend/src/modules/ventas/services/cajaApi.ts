import { api } from "@/shared/api/client";
import type { MovimientoCaja, SesionCaja, SesionResumen } from "@/shared/types/api";

interface AbrirCajaIn {
  saldo_inicial: number;
  cajero_nombre?: string;
  codigo?: string;
}
interface CerrarCajaIn {
  saldo_final: number;
  notas?: string;
}
interface MovimientoCajaIn {
  tipo: "ingreso" | "retiro";
  monto: number;
  referencia?: string;
  concepto?: string;
  notas?: string;
  metodo_pago?: string;
}
interface HistorialPage {
  items: SesionResumen[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const cajaApi = {
  /** Estado de la sesión de caja actualmente abierta (null si no hay ninguna). */
  getEstado: async (): Promise<SesionCaja | null> => {
    try {
      const r = await api.get<SesionCaja>("/caja/estado");
      return r.data;
    } catch (err: unknown) {
      if ((err as { response?: { status: number } }).response?.status === 404) return null;
      throw err;
    }
  },

  abrirCaja: async (body: AbrirCajaIn): Promise<SesionCaja> => {
    const r = await api.post<SesionCaja>("/caja/abrir", body);
    return r.data;
  },

  cerrarCaja: async (sesion_id: string, body: CerrarCajaIn): Promise<SesionCaja> => {
    const r = await api.post<SesionCaja>(`/caja/cerrar/${sesion_id}`, body);
    return r.data;
  },

  registrarMovimiento: async (body: MovimientoCajaIn): Promise<MovimientoCaja> => {
    const r = await api.post<MovimientoCaja>("/caja/movimiento", body);
    return r.data;
  },

  listMovimientos: async (): Promise<MovimientoCaja[]> => {
    const r = await api.get<MovimientoCaja[]>("/caja/movimientos");
    return r.data;
  },

  /** Historial paginado de sesiones cerradas y abiertas. */
  getHistorial: async (
    page = 1,
    desde?: string,
    hasta?: string,
    page_size = 20,
  ): Promise<HistorialPage> => {
    const params: Record<string, string | number> = { page, page_size };
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    const r = await api.get<HistorialPage>("/caja/historial", { params });
    return r.data;
  },

  /** Detalle completo de una sesión específica (incluye movimientos). */
  getSesion: async (sesion_id: string): Promise<SesionCaja> => {
    const r = await api.get<SesionCaja>(`/caja/sesion/${sesion_id}`);
    return r.data;
  },
};
