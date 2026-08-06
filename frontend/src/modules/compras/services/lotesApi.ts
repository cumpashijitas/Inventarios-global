import { api } from "@/shared/api/client";
import type { Lote, LoteIn, LoteItem, Page } from "@/shared/types/api";

type LoteItemIn = Omit<LoteItem, "id" | "lote_id" | "procesado">;

export const lotesApi = {
  listLotes: async (params: { page?: number; page_size?: number } = {}): Promise<Page<Lote>> => {
    const r = await api.get<Page<Lote>>("/lotes", { params });
    return r.data;
  },

  getLote: async (id: string): Promise<Lote> => {
    const r = await api.get<Lote>(`/lotes/${id}`);
    return r.data;
  },

  createLote: async (body: LoteIn): Promise<Lote> => {
    const r = await api.post<Lote>("/lotes", body);
    return r.data;
  },

  /** Reemplaza TODOS los ítems del lote (planilla completa). */
  saveItems: async (lote_id: string, items: LoteItemIn[]): Promise<Lote> => {
    const r = await api.put<Lote>(`/lotes/${lote_id}/items`, { items });
    return r.data;
  },

  /** Confirma el lote → crea/actualiza productos y genera entradas de stock. */
  confirmarLote: async (id: string): Promise<{ ok: boolean; procesados: number }> => {
    const r = await api.post<{ ok: boolean; procesados: number }>(`/lotes/${id}/confirmar`);
    return r.data;
  },

  /** Guarda los ítems Y actualiza el inventario en un solo paso. */
  guardar: async (lote_id: string, items: LoteItemIn[]): Promise<Lote> => {
    const r = await api.post<Lote>(`/lotes/${lote_id}/guardar`, { items });
    return r.data;
  },

  deleteLote: async (id: string): Promise<void> => {
    await api.delete(`/lotes/${id}`);
  },

  /** Sube un PDF/Excel/CSV y retorna los productos extraídos con match_status. */
  parseArchivo: async (file: File): Promise<ParseArchivoResult> => {
    const form = new FormData();
    form.append("file", file);
    const r = await api.post<ParseArchivoResult>("/lotes/parse-archivo", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data;
  },
};

export type MatchStatus = "existente" | "probable" | "nuevo" | "incompleto" | "conflicto";

export interface InvData {
  nombre?: string | null;
  marca?: string | null;
  precio_compra?: string | null;
  precio_venta?: string | null;
  precio_mecanico?: string | null;
  precio_mayor?: string | null;
  aplicacion?: string | null;
  medidas?: string | null;
  modelos?: string | null;
  anio_desde?: number | null;
  anio_hasta?: number | null;
  descripcion?: string | null;
}

export interface ParsedItem {
  sku?: string;
  nombre?: string;
  cantidad?: string;
  precio_compra?: string;
  marca?: string;
  modelos?: string;
  descripcion?: string;
  match_status: MatchStatus;
  match_id?: string | null;
  match_sku?: string | null;
  match_nombre?: string | null;
  confianza: number;
  inv_data?: InvData | null;
}

export interface ParseArchivoResult {
  filename: string;
  items_extraidos: number;
  items: ParsedItem[];
  advertencias: string[];
}
