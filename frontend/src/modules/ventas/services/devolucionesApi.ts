import { api } from "@/shared/api/client";
import type { Page } from "@/shared/types/api";

export interface Devolucion {
  id: string;
  empresa_id: string;
  venta_id: string;
  venta_item_id: string | null;
  venta_numero: string | null;
  atendido_por: string | null;
  motivo: string;
  notas: string | null;
  producto_devuelto_id: string;
  producto_devuelto_nombre: string | null;
  producto_devuelto_sku: string | null;
  cantidad_devuelta: string;
  monto_devuelto: string;
  producto_nuevo_id: string | null;
  producto_nuevo_nombre: string | null;
  producto_nuevo_sku: string | null;
  cantidad_nueva: string | null;
  monto_cobrado: string;
  diferencia: string;
  movimiento_caja_id: string | null;
  created_at: string;
}

export interface DevolucionIn {
  venta_id: string;
  venta_item_id: string;
  producto_devuelto_id: string;
  cantidad_devuelta: number;
  motivo: "error_nuestro" | "defecto_fabrica" | "cambio_medida" | "otro";
  notas?: string;
  producto_nuevo_id?: string;
  cantidad_nueva?: number;
}

export const MOTIVO_LABELS: Record<string, string> = {
  error_nuestro:   "Error nuestro",
  defecto_fabrica: "Defecto de fábrica",
  cambio_medida:   "Cambio de talla / medida",
  otro:            "Otro",
};

export const devolucionesApi = {
  listar: async (page = 1, page_size = 50): Promise<Page<Devolucion>> => {
    const r = await api.get<Page<Devolucion>>("/devoluciones", { params: { page, page_size } });
    return r.data;
  },
  crear: async (body: DevolucionIn): Promise<Devolucion> => {
    const r = await api.post<Devolucion>("/devoluciones", body);
    return r.data;
  },
};
