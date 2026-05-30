import { api } from "@/shared/api/client";
import type {
  Cotizacion,
  CotizacionIn,
  Page,
  Venta,
  VentaIn,
} from "@/shared/types/api";

interface ListVentasParams {
  page?: number;
  page_size?: number;
  estado?: string;
  desde?: string;
  hasta?: string;
}
interface ListCotizacionesParams {
  page?: number;
  page_size?: number;
  estado?: string;
}

export const ventasApi = {
  // ─── Ventas ──────────────────────────────────────────────────────────────
  listVentas: async (params: ListVentasParams = {}): Promise<Page<Venta>> => {
    const r = await api.get<Page<Venta>>("/ventas", { params });
    return r.data;
  },
  getVenta: async (id: string): Promise<Venta> => {
    const r = await api.get<Venta>(`/ventas/${id}`);
    return r.data;
  },
  createVenta: async (body: VentaIn): Promise<Venta> => {
    const r = await api.post<Venta>("/ventas", body);
    return r.data;
  },
  anularVenta: async (id: string): Promise<{ ok: boolean }> => {
    const r = await api.post<{ ok: boolean }>(`/ventas/${id}/anular`);
    return r.data;
  },

  // ─── Cotizaciones ────────────────────────────────────────────────────────
  listCotizaciones: async (params: ListCotizacionesParams = {}): Promise<Page<Cotizacion>> => {
    const r = await api.get<Page<Cotizacion>>("/ventas/cotizaciones", { params });
    return r.data;
  },
  getCotizacion: async (id: string): Promise<Cotizacion> => {
    const r = await api.get<Cotizacion>(`/ventas/cotizaciones/${id}`);
    return r.data;
  },
  createCotizacion: async (body: CotizacionIn): Promise<Cotizacion> => {
    const r = await api.post<Cotizacion>("/ventas/cotizaciones", body);
    return r.data;
  },
  cambiarEstadoCotizacion: async (
    id: string,
    estado: "pendiente" | "aprobada" | "rechazada" | "vencida" | "convertida",
  ): Promise<Cotizacion> => {
    const r = await api.patch<Cotizacion>(`/ventas/cotizaciones/${id}/estado`, { estado });
    return r.data;
  },

  // ─── Top productos más vendidos ──────────────────────────────────────────
  topProductos: async (dias = 30, limit = 5): Promise<TopProducto[]> => {
    const r = await api.get<TopProducto[]>("/ventas/top-productos", { params: { dias, limit } });
    return r.data;
  },
};

export interface TopProducto {
  sku: string;
  nombre: string;
  cantidad_vendida: number;
  total_vendido: number;
}
