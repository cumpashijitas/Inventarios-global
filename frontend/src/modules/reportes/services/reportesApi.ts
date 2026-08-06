import { api } from "@/shared/api/client";
import type {
  RankingVendedoresOut,
  ReporteInventario,
  ReporteMovimiento,
  ReporteMovimientosPage,
  ReporteVentas,
} from "@/shared/types/api";

export const reportesApi = {
  getVentas: async (desde: string, hasta: string, search?: string): Promise<ReporteVentas> => {
    const r = await api.get<ReporteVentas>("/reportes/ventas", {
      params: { desde, hasta, search: search || undefined },
    });
    return r.data;
  },

  getRankingVendedores: async (desde: string, hasta: string): Promise<RankingVendedoresOut> => {
    const r = await api.get<RankingVendedoresOut>("/reportes/ranking-vendedores", {
      params: { desde, hasta },
    });
    return r.data;
  },

  getInventario: async (): Promise<ReporteInventario> => {
    const r = await api.get<ReporteInventario>("/reportes/inventario");
    return r.data;
  },

  getMovimientos: async (
    desde: string,
    hasta: string,
    page = 1,
    page_size = 20,
  ): Promise<ReporteMovimientosPage> => {
    const r = await api.get<ReporteMovimientosPage>("/reportes/movimientos", {
      params: { desde, hasta, page, page_size },
    });
    return r.data;
  },

  /** Trae hasta 500 movimientos para exportar (PDF). */
  getAllMovimientos: async (desde: string, hasta: string): Promise<ReporteMovimiento[]> => {
    const r = await api.get<ReporteMovimientosPage>("/reportes/movimientos", {
      params: { desde, hasta, page: 1, page_size: 500 },
    });
    return r.data.items;
  },
};
