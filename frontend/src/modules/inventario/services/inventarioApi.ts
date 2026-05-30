import { api } from "@/shared/api/client";
import type {
  AjusteStockIn,
  Almacen,
  AlmacenIn,
  Categoria,
  CategoriaIn,
  Cliente,
  ClienteIn,
  MovimientoStock,
  Page,
  Producto,
  ProductoIn,
  Proveedor,
  ProveedorIn,
  Stock,
  UnidadMedida,
} from "@/shared/types/api";

// ─── Tipos parciales para update ─────────────────────────────────────────────
type ProductoUpdate = Partial<Omit<ProductoIn, "sku">>;
type ProveedorUpdate = Partial<ProveedorIn>;
type ClienteUpdate = Partial<ClienteIn>;

// ─── Parámetros de listado ────────────────────────────────────────────────────
interface ListParams {
  page?: number;
  page_size?: number;
  search?: string;
}
interface ListProductosParams extends ListParams {
  only_active?: boolean;
}
interface ListProveedoresParams extends ListParams {
  only_active?: boolean;
}
interface ListClientesParams extends ListParams {
  tipo?: "mecanico" | "mayorista" | "particular";
}

export const inventarioApi = {
  // ─── Productos ───────────────────────────────────────────────────────────
  listProductos: async (params: ListProductosParams = {}): Promise<Page<Producto>> => {
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
  updateProducto: async (id: string, body: ProductoUpdate): Promise<Producto> => {
    const r = await api.patch<Producto>(`/inventario/productos/${id}`, body);
    return r.data;
  },
  deleteProducto: async (id: string): Promise<void> => {
    await api.delete(`/inventario/productos/${id}`);
  },
  uploadImagenProducto: async (id: string, file: File): Promise<{ imagen_url: string }> => {
    const form = new FormData();
    form.append("file", file);
    const r = await api.post<{ imagen_url: string }>(`/inventario/productos/${id}/imagen`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data;
  },

  // ─── Categorías ──────────────────────────────────────────────────────────
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

  // ─── Unidades de Medida ──────────────────────────────────────────────────
  listUnidades: async (only_active = true): Promise<UnidadMedida[]> => {
    const r = await api.get<UnidadMedida[]>("/inventario/unidades", {
      params: { only_active },
    });
    return r.data;
  },

  // ─── Almacenes ───────────────────────────────────────────────────────────
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

  // ─── Stock / Movimientos ─────────────────────────────────────────────────
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
  } = {}): Promise<MovimientoStock[]> => {
    const r = await api.get<MovimientoStock[]>("/inventario/movimientos", { params });
    return r.data;
  },

  // ─── Proveedores ─────────────────────────────────────────────────────────
  listProveedores: async (params: ListProveedoresParams = {}): Promise<Page<Proveedor>> => {
    const r = await api.get<Page<Proveedor>>("/inventario/proveedores", { params });
    return r.data;
  },
  getProveedor: async (id: string): Promise<Proveedor> => {
    const r = await api.get<Proveedor>(`/inventario/proveedores/${id}`);
    return r.data;
  },
  createProveedor: async (body: ProveedorIn): Promise<Proveedor> => {
    const r = await api.post<Proveedor>("/inventario/proveedores", body);
    return r.data;
  },
  updateProveedor: async (id: string, body: ProveedorUpdate): Promise<Proveedor> => {
    const r = await api.patch<Proveedor>(`/inventario/proveedores/${id}`, body);
    return r.data;
  },
  deleteProveedor: async (id: string): Promise<void> => {
    await api.delete(`/inventario/proveedores/${id}`);
  },

  // ─── Clientes ────────────────────────────────────────────────────────────
  listClientes: async (params: ListClientesParams = {}): Promise<Page<Cliente>> => {
    const r = await api.get<Page<Cliente>>("/inventario/clientes", { params });
    return r.data;
  },
  getCliente: async (id: string): Promise<Cliente> => {
    const r = await api.get<Cliente>(`/inventario/clientes/${id}`);
    return r.data;
  },
  createCliente: async (body: ClienteIn): Promise<Cliente> => {
    const r = await api.post<Cliente>("/inventario/clientes", body);
    return r.data;
  },
  updateCliente: async (id: string, body: ClienteUpdate): Promise<Cliente> => {
    const r = await api.patch<Cliente>(`/inventario/clientes/${id}`, body);
    return r.data;
  },
  deleteCliente: async (id: string): Promise<void> => {
    await api.delete(`/inventario/clientes/${id}`);
  },
};
