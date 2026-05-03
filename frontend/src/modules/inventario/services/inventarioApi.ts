import { api } from "@/shared/api/client";
import type {
  AjusteStockIn,
  Almacen,
  AlmacenIn,
  MovimientoStock,
  Page,
  Producto,
  ProductoIn,
  Stock,
} from "@/shared/types/api";

interface ListProductosParams {
  page?: number;
  page_size?: number;
  search?: string;
  only_active?: boolean;
}

export const inventarioApi = {
  // -------- Productos --------
  listProductos: async (params: ListProductosParams): Promise<Page<Producto>> => {
    const r = await api.get<Page<Producto>>("/inventario/productos", { params });
    return r.data;
  },
  getProducto: async (id: string): Promise<Producto> => {
    const r = await api.get<Producto>(`/inventario/productos/${id}`);
    return r.data;
  },
  createProducto: async (body: ProductoIn): Promise<Producto> => {
    const r = await api.post<Producto>("/inventario/productos", body);
    return r.data;
  },
  updateProducto: async (id: string, body: Partial<ProductoIn>): Promise<Producto> => {
    const r = await api.patch<Producto>(`/inventario/productos/${id}`, body);
    return r.data;
  },
  deleteProducto: async (id: string): Promise<void> => {
    await api.delete(`/inventario/productos/${id}`);
  },

  // -------- Almacenes --------
  listAlmacenes: async (only_active = true): Promise<Almacen[]> => {
    const r = await api.get<Almacen[]>("/inventario/almacenes", {
      params: { only_active },
    });
    return r.data;
  },
  createAlmacen: async (body: AlmacenIn): Promise<Almacen> => {
    const r = await api.post<Almacen>("/inventario/almacenes", body);
    return r.data;
  },

  // -------- Stock / Movimientos --------
  stockProducto: async (producto_id: string, almacen_id?: string): Promise<Stock[]> => {
    const r = await api.get<Stock[]>(`/inventario/stock/${producto_id}`, {
      params: almacen_id ? { almacen_id } : {},
    });
    return r.data;
  },
  ajustarStock: async (body: AjusteStockIn): Promise<{ movimiento_id: string }> => {
    const r = await api.post<{ movimiento_id: string }>("/inventario/movimientos", body);
    return r.data;
  },
  listMovimientos: async (params: {
    producto_id?: string;
    almacen_id?: string;
    limit?: number;
  }): Promise<MovimientoStock[]> => {
    const r = await api.get<MovimientoStock[]>("/inventario/movimientos", { params });
    return r.data;
  },
};
