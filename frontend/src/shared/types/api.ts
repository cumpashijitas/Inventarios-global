/** Tipos compartidos del API backend (espejo de los schemas Pydantic). */

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ----- Auth -----
export interface EmpresaResumen {
  id: string;
  razon_social: string;
  rol: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  empresa_id?: string | null;
  rol?: string | null;
}

export interface LoginResponse {
  user_id: string;
  email: string;
  empresas: EmpresaResumen[];
  tokens: TokenResponse | null;
}

export interface MeResponse {
  user_id: string;
  email: string | null;
  empresa_id: string | null;
  rol: string | null;
}

// ----- Inventario -----
export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  descripcion?: string | null;
  categoria_id?: string | null;
  unidad_id: string;
  precio_compra: string;
  precio_venta: string;
  stock_minimo: string;
  stock_maximo?: string | null;
  controla_stock: boolean;
  activo: boolean;
  imagen_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductoIn {
  sku: string;
  nombre: string;
  descripcion?: string | null;
  codigo_barras?: string | null;
  categoria_id?: string | null;
  unidad_id: string;
  precio_compra: number | string;
  precio_venta: number | string;
  moneda?: string;
  stock_minimo: number | string;
  stock_maximo?: number | string | null;
  controla_stock: boolean;
  imagen_url?: string | null;
}

export interface Almacen {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  direccion?: string | null;
  ciudad?: string | null;
  activo: boolean;
}

export interface AlmacenIn {
  codigo: string;
  nombre: string;
  tipo?: "fisico" | "movil" | "consigna";
  direccion?: string | null;
  ciudad?: string | null;
}

export interface Stock {
  producto_id: string;
  almacen_id: string;
  cantidad: string;
  costo_promedio: string;
  updated_at: string;
}

export interface MovimientoStock {
  id: string;
  producto_id: string;
  almacen_id: string;
  tipo: string;
  cantidad: string;
  costo_unitario: string;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
  motivo?: string | null;
  created_at: string;
}

export interface AjusteStockIn {
  producto_id: string;
  almacen_id: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  costo_unitario?: number;
  motivo?: string | null;
}

// ----- Categorías -----
export interface Categoria {
  id: string;
  parent_id: string | null;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoriaIn {
  nombre: string;
  parent_id?: string | null;
  orden?: number;
}

// ----- Unidades de medida -----
export interface Unidad {
  id: string;
  codigo: string;
  nombre: string;
  decimales: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnidadIn {
  codigo: string;
  nombre: string;
  decimales?: number;
}

// ----- Stock consolidado -----
export interface StockConsolidadoItem {
  producto_id: string;
  sku: string;
  producto_nombre: string;
  stock_minimo: string;
  stock_maximo: string | null;
  almacen_id: string;
  almacen_codigo: string;
  almacen_nombre: string;
  cantidad: string;
  costo_promedio: string;
  valor: string;
  bajo_minimo: boolean;
  updated_at: string;
}

export interface StockConsolidadoPage {
  items: StockConsolidadoItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  valor_total: string;
  bajo_minimo_count: number;
}

// ----- Reportes -----
export interface ReporteInventarioKPIs {
  productos_con_stock: number;
  combinaciones: number;
  unidades_totales: string;
  valor_total: string;
  bajo_minimo_count: number;
}

export interface ReporteInventarioTopItem {
  id: string;
  sku: string;
  nombre: string;
  cantidad: string;
  valor: string;
}

export interface ReporteInventarioCategoria {
  categoria: string;
  valor: string;
  productos: number;
}

export interface ReporteInventarioOut {
  kpis: ReporteInventarioKPIs;
  top_valor: ReporteInventarioTopItem[];
  por_categoria: ReporteInventarioCategoria[];
}

export interface ReporteMovimientosResumen {
  entradas: number;
  salidas: number;
  ajustes: number;
  transferencias: number;
  unidades_entrada: string;
  unidades_salida: string;
}

export interface ReporteMovimientosItem {
  id: string;
  created_at: string;
  tipo: string;
  cantidad: string;
  costo_unitario: string;
  referencia_tipo: string | null;
  referencia_id: string | null;
  motivo: string | null;
  sku: string;
  producto_nombre: string;
  almacen_codigo: string;
  almacen_nombre: string;
}

export interface ReporteMovimientosOut {
  items: ReporteMovimientosItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  resumen: ReporteMovimientosResumen;
  rango: { desde: string; hasta: string };
}

export interface ReporteBajoStockItem {
  producto_id: string;
  sku: string;
  nombre: string;
  stock_minimo: string;
  stock_maximo: string | null;
  almacen_id: string;
  almacen_codigo: string;
  almacen_nombre: string;
  stock_actual: string;
  sugerencia_reorden: string;
}

export interface ReporteBajoStockOut {
  items: ReporteBajoStockItem[];
  total: number;
}
