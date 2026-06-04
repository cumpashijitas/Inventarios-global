/** Tipos compartidos del API backend (espejo de los schemas Pydantic). */

export interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface EmpresaResumen { id: string; razon_social: string; rol: string }
export interface TokenResponse {
  access_token: string; refresh_token: string; token_type: string;
  expires_in: number; empresa_id?: string | null; rol?: string | null;
}
export interface LoginResponse {
  user_id: string; email: string; empresas: EmpresaResumen[];
  tokens: TokenResponse | null;
}
export interface MeResponse {
  user_id: string; email: string | null; empresa_id: string | null; rol: string | null;
}
export interface EmpresaPerfil {
  razon_social: string | null;
  nombre_comercial: string | null;
  nit: string | null;
  pais: string | null;
  moneda_principal: string | null;
  logo_url: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  email: string | null;
}

// ─── Inventario — Productos ───────────────────────────────────────────────────
export interface Producto {
  id: string; sku: string; nombre: string;
  descripcion?: string | null; categoria_id?: string | null; unidad_id: string;
  precio_compra: string;
  precio_venta: string;
  precio_mecanico?: string | null;
  precio_mayor?: string | null;
  precio_real?: string | null;
  costo_caja?: string | null;
  stock_minimo: string; stock_maximo?: string | null;
  controla_stock: boolean; activo: boolean;
  imagen_url?: string | null;
  marca?: string | null; proveedor_id?: string | null;
  aplicacion?: string | null; medidas?: string | null;
  peso?: string | null; modelos?: string | null;
  anio_desde?: number | null; anio_hasta?: number | null;
  ubicacion?: string | null;
  codigo_universal?: string | null;
  procedencia?: string | null;
  industria?: string | null;
  motor?: string | null;
  // campo calculado por join en el listado
  stock_total?: number;
  created_at: string; updated_at: string;
}
export interface ProductoIn {
  sku: string; nombre: string; descripcion?: string | null;
  codigo_barras?: string | null; categoria_id?: string | null;
  unidad_id: string;
  precio_compra: number | string; precio_venta: number | string;
  precio_mecanico?: number | string | null; precio_mayor?: number | string | null;
  precio_real?: number | string | null; costo_caja?: number | string | null;
  moneda?: string; stock_minimo: number | string; stock_maximo?: number | string | null;
  controla_stock: boolean; imagen_url?: string | null;
  marca?: string | null; proveedor_id?: string | null;
  aplicacion?: string | null; medidas?: string | null;
  peso?: number | string | null; modelos?: string | null;
  anio_desde?: number | null; anio_hasta?: number | null; ubicacion?: string | null;
  activo?: boolean;
  codigo_universal?: string | null;
  procedencia?: string | null;
  industria?: string | null;
  motor?: string | null;
}

// ─── Inventario — Almacenes / Stock ──────────────────────────────────────────
export interface Almacen {
  id: string; codigo: string; nombre: string; tipo: string;
  direccion?: string | null; ciudad?: string | null; activo: boolean;
}
export interface AlmacenIn {
  codigo: string; nombre: string; tipo?: "fisico"|"movil"|"consigna";
  direccion?: string | null; ciudad?: string | null;
}
export interface Stock {
  producto_id: string; almacen_id: string;
  cantidad: string; costo_promedio: string; updated_at: string;
}
export interface MovimientoStock {
  id: string; producto_id: string; almacen_id: string;
  tipo: string; cantidad: string; costo_unitario: string;
  referencia_tipo?: string | null; referencia_id?: string | null;
  motivo?: string | null; created_at: string;
}
export interface AjusteStockIn {
  producto_id: string; almacen_id: string;
  tipo: "entrada"|"salida"|"ajuste"; cantidad: number;
  costo_unitario?: number; motivo?: string | null;
}

// ─── Inventario — Categorías / Unidades ──────────────────────────────────────
export interface Categoria { id: string; nombre: string; parent_id?: string | null; orden: number; activo: boolean }
export interface CategoriaIn { nombre: string; parent_id?: string | null; orden?: number }
export interface UnidadMedida { id: string; codigo: string; nombre: string; decimales: number; activo: boolean }

// ─── Inventario — Proveedores ─────────────────────────────────────────────────
export interface Proveedor {
  id: string; codigo?: string | null; razon_social: string;
  nombre_contacto?: string | null; email?: string | null;
  telefono?: string | null; celular?: string | null;
  direccion?: string | null; ciudad?: string | null; pais: string;
  nit?: string | null; categoria: string;
  banco?: string | null; cuenta_bancaria?: string | null;
  notas?: string | null; activo: boolean; created_at: string;
}
export interface ProveedorIn {
  razon_social: string; codigo?: string | null; nombre_contacto?: string | null;
  email?: string | null; telefono?: string | null; celular?: string | null;
  direccion?: string | null; ciudad?: string | null; pais?: string;
  nit?: string | null; categoria?: string;
  banco?: string | null; cuenta_bancaria?: string | null; notas?: string | null;
  activo?: boolean;
}

// ─── Inventario — Clientes ────────────────────────────────────────────────────
export interface Cliente {
  id: string; codigo?: string | null; nombre: string;
  tipo: "mecanico"|"mayorista"|"particular";
  email?: string | null; telefono?: string | null; celular?: string | null;
  direccion?: string | null; ciudad?: string | null; nit?: string | null;
  limite_credito: string; dias_credito: number; descuento_pct: string;
  notas?: string | null; activo: boolean; created_at: string;
}
export interface ClienteIn {
  nombre: string; tipo: "mecanico"|"mayorista"|"particular";
  codigo?: string | null; email?: string | null; telefono?: string | null;
  celular?: string | null; direccion?: string | null; ciudad?: string | null;
  nit?: string | null; limite_credito?: number; dias_credito?: number;
  descuento_pct?: number; notas?: string | null; activo?: boolean;
}

// ─── Ventas ───────────────────────────────────────────────────────────────────
export interface VentaItem {
  id: string; producto_id?: string | null; sku: string; nombre: string;
  cantidad: string; precio_unitario: string; descuento_pct: string;
  subtotal: string; costo_unitario: string;
}
export interface Venta {
  id: string; numero: string; cliente_id?: string | null; cliente_nombre?: string | null;
  cliente_tipo?: string | null; vendedor_nombre?: string | null;
  fecha: string; estado: string; metodo_pago: string;
  subtotal: string; descuento_pct: string; descuento_monto: string;
  impuesto_monto: string; total: string; monto_pagado: string; cambio: string;
  notas?: string | null; created_at: string; items: VentaItem[];
}
export interface VentaItemIn {
  producto_id?: string | null; sku: string; nombre: string;
  cantidad: number; precio_unitario: number; descuento_pct?: number;
  costo_unitario?: number;
}
export interface VentaIn {
  cliente_id?: string | null; cliente_nombre?: string | null;
  cliente_nit?: string | null; fecha?: string;
  metodo_pago: "efectivo"|"tarjeta_credito"|"tarjeta_debito"|"transferencia"|"mixto";
  descuento_pct?: number; impuesto_pct?: number; monto_pagado?: number;
  almacen_id?: string | null; caja_sesion_id?: string | null;
  notas?: string | null; items: VentaItemIn[];
}

// ─── Cotizaciones ─────────────────────────────────────────────────────────────
export interface CotizacionItem {
  id: string; producto_id?: string | null; sku: string; nombre: string;
  cantidad: string; precio_unitario: string; descuento_pct: string; subtotal: string;
}
export interface Cotizacion {
  id: string; numero: string; cliente_id?: string | null; cliente_nombre?: string | null;
  cliente_tipo?: string | null; vendedor_nombre?: string | null;
  fecha: string; fecha_vence?: string | null; vigencia_dias: number; estado: string;
  subtotal: string; descuento_monto: string; total: string;
  notas?: string | null; created_at: string; items: CotizacionItem[];
}
export interface CotizacionIn {
  cliente_id?: string | null; cliente_nombre?: string | null;
  fecha?: string; vigencia_dias?: number; descuento_monto?: number;
  notas?: string | null; items: VentaItemIn[];
}

// ─── Caja ─────────────────────────────────────────────────────────────────────
export interface MovimientoCaja {
  id: string; sesion_id: string; tipo: string; referencia?: string | null;
  metodo_pago?: string | null; monto: string; saldo_acumulado: string;
  notas?: string | null; created_at: string;
}
export interface MetodoPagoResumen { metodo_pago: string; total: string; transacciones: number }
export interface SesionCaja {
  id: string; codigo: string; cajero_nombre?: string | null;
  estado: string; saldo_inicial: string; saldo_final?: string | null;
  saldo_actual?: string | null; diferencia?: string | null;
  abierta_en: string; cerrada_en?: string | null;
  movimientos: MovimientoCaja[]; metodos_pago: MetodoPagoResumen[];
}
export interface SesionResumen {
  id: string; codigo: string; cajero_nombre?: string | null;
  estado: string; saldo_inicial: string; saldo_final?: string | null;
  saldo_esperado?: string | null; diferencia?: string | null;
  total_ingresos: string; total_retiros: string; num_ventas: number;
  abierta_en: string; cerrada_en?: string | null;
}

// ─── Lotes ────────────────────────────────────────────────────────────────────
export interface LoteItem {
  id: string; lote_id: string; producto_id?: string | null;
  sku: string; nombre: string; categoria?: string | null; marca?: string | null;
  precio_real?: string | null; precio_unitario?: string | null;
  precio_mecanico?: string | null; precio_mayor?: string | null;
  cantidad: string; stock_minimo: string; ubicacion?: string | null;
  proveedor?: string | null; aplicacion?: string | null;
  medidas?: string | null; peso?: string | null; modelos?: string | null;
  anio_desde?: number | null; anio_hasta?: number | null;
  descripcion?: string | null; procesado: boolean;
}
export interface Lote {
  id: string; referencia: string; proveedor_id?: string | null;
  proveedor_nombre?: string | null; fecha: string; estado: string;
  productos_count: number; total_estimado?: string | null;
  notas?: string | null; created_at: string; items: LoteItem[];
}
export interface LoteIn {
  referencia: string; proveedor_id?: string | null;
  proveedor_nombre?: string | null; fecha?: string; notas?: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface ActividadItem {
  id: string;
  tipo: string;           // "venta.crear" | "cliente.crear" | etc.
  titulo: string;
  descripcion?: string | null;
  usuario_nombre: string;
  created_at: string;
}
export interface DashboardStats {
  ventas_hoy: number; ordenes_hoy: number;
  total_productos: number; stock_bajo: number;
  ventas_semana: { dia: string; fecha: string; total: number }[];
  categorias: { nombre: string; cantidad: number; valor: number }[];
  actividad_reciente: ActividadItem[];
}

// ─── Reportes ─────────────────────────────────────────────────────────────────
export interface ReporteVentas {
  periodo: { desde: string; hasta: string };
  resumen: {
    ingresos_totales: number; costo_total: number; ganancia_bruta: number;
    margen: number; transacciones: number; ticket_promedio: number;
  };
  top_productos: { sku: string; nombre: string; cantidad_vendida: number; total_vendido: number }[];
  ventas_por_dia: { fecha: string; transacciones: number; total: number }[];
}
export interface ReporteInventario {
  resumen: {
    total_productos: number; valor_total: number; stock_bajo: number;
    sin_stock: number; categorias: number; proveedores: number;
  };
}
export interface ReporteMovimiento {
  id: string; tipo: string; cantidad: number; costo_unitario: number;
  referencia_tipo?: string | null; motivo?: string | null; created_at: string;
  sku: string; producto_nombre: string; almacen_nombre?: string | null;
}
export interface ReporteMovimientosPage {
  periodo: { desde: string; hasta: string };
  items: ReporteMovimiento[];
  total: number; page: number; page_size: number; total_pages: number;
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
