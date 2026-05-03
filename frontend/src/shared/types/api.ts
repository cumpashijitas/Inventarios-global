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
