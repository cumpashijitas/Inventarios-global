import { api } from "@/shared/api/client";
import type {
  AjusteStockIn,
  Almacen,
  AlmacenIn,
  Categoria,
  CategoriaIn,
  MovimientoStock,
  Page,
  Producto,
  ProductoIn,
  ReporteBajoStockOut,
  ReporteInventarioOut,
  ReporteMovimientosOut,
  Stock,
  StockConsolidadoPage,
  Unidad,
  UnidadIn,
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

  // -------- Stock consolidado --------
  stockConsolidado: async (params: {
    page?: number;
    page_size?: number;
    almacen_id?: string;
    search?: string;
    only_low_stock?: boolean;
  }): Promise<StockConsolidadoPage> => {
    const r = await api.get<StockConsolidadoPage>("/inventario/stock", { params });
    return r.data;
  },

  // -------- Categorías --------
  listCategorias: async (only_active = true): Promise<Categoria[]> => {
    const r = await api.get<Categoria[]>("/inventario/categorias", {
      params: { only_active },
    });
    return r.data;
  },
  createCategoria: async (body: CategoriaIn): Promise<Categoria> => {
    const r = await api.post<Categoria>("/inventario/categorias", body);
    return r.data;
  },
  updateCategoria: async (id: string, body: Partial<CategoriaIn> & { activo?: boolean }): Promise<Categoria> => {
    const r = await api.patch<Categoria>(`/inventario/categorias/${id}`, body);
    return r.data;
  },
  deleteCategoria: async (id: string): Promise<void> => {
    await api.delete(`/inventario/categorias/${id}`);
  },

  // -------- Unidades --------
  listUnidades: async (only_active = true): Promise<Unidad[]> => {
    const r = await api.get<Unidad[]>("/inventario/unidades", {
      params: { only_active },
    });
    return r.data;
  },
  createUnidad: async (body: UnidadIn): Promise<Unidad> => {
    const r = await api.post<Unidad>("/inventario/unidades", body);
    return r.data;
  },
  updateUnidad: async (id: string, body: Partial<UnidadIn> & { activo?: boolean }): Promise<Unidad> => {
    const r = await api.patch<Unidad>(`/inventario/unidades/${id}`, body);
    return r.data;
  },
  desactivarUnidad: async (id: string): Promise<void> => {
    await api.delete(`/inventario/unidades/${id}`);
  },

  // -------- Reportes --------
  reporteInventario: async (almacen_id?: string): Promise<ReporteInventarioOut> => {
    const r = await api.get<ReporteInventarioOut>("/inventario/reportes/inventario", {
      params: almacen_id ? { almacen_id } : {},
    });
    return r.data;
  },
  reporteMovimientos: async (params: {
    desde?: string;
    hasta?: string;
    producto_id?: string;
    almacen_id?: string;
    tipo?: string;
    page?: number;
    page_size?: number;
  }): Promise<ReporteMovimientosOut> => {
    const r = await api.get<ReporteMovimientosOut>("/inventario/reportes/movimientos", {
      params,
    });
    return r.data;
  },
  reporteBajoStock: async (): Promise<ReporteBajoStockOut> => {
    const r = await api.get<ReporteBajoStockOut>("/inventario/reportes/bajo-stock");
    return r.data;
  },
};
