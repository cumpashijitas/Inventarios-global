import {
  AlertTriangle, BookOpen, Building2, Car, Copy, CreditCard, Download, Eye, FolderOpen,
  Gem, ImageIcon, Info, Mail, MapPin, Package, Pencil, Phone,
  Plus, Ruler, Search, ShieldCheck, Tag, Trash2, User, X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/shared/stores/auth.store";
import { puedeAcceder } from "@/shared/config/roles";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import type {
  Almacen, Categoria, CategoriaIn, Cliente, ClienteIn, Producto, ProductoIn,
  Proveedor, ProveedorIn, UnidadMedida,
} from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de UI (derivados del API, sin mock)
// ─────────────────────────────────────────────────────────────────────────────
type Tab = "productos" | "proveedores" | "clientes" | "categorias";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de badges
// ─────────────────────────────────────────────────────────────────────────────
function StockBadge({ stock, min }: { stock: number | string; min: number | string }) {
  const s = Math.round(Number(stock));
  const m = Math.round(Number(min));
  const color = s === 0 ? "bg-red-100 text-red-700"
    : s < m ? "bg-yellow-100 text-yellow-700"
    : "bg-green-100 text-green-700";
  return (
    <div className={`inline-flex flex-col items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-tight ${color}`}>
      <span>{s} uds</span>
      {s < m && s > 0 && <span className="text-[10px] font-normal">Min: {m}</span>}
    </div>
  );
}
function TipoBadge({ tipo }: { tipo: Cliente["tipo"] }) {
  const map: Record<string, string> = { mecanico: "bg-blue-100 text-blue-700", mayorista: "bg-green-100 text-green-700", particular: "bg-slate-100 text-slate-600" };
  const label: Record<string, string> = { mecanico: "Mecánico", mayorista: "Mayorista", particular: "Particular" };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[tipo] ?? "bg-slate-100 text-slate-600"}`}>{label[tipo] ?? tipo}</span>;
}
function EstadoBadge({ activo }: { activo: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${activo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{activo ? "Activo" : "Inactivo"}</span>;
}
function AccionesBtn({ onVer, onCopiar, onEditar, onEliminar }: { onVer?: () => void; onCopiar?: () => void; onEditar?: () => void; onEliminar?: () => void }) {
  return (
    <div className="flex items-center gap-1">
      {onVer     && <button onClick={onVer}     className="rounded p-1 text-blue-500 hover:bg-blue-50"><Eye     className="h-3.5 w-3.5" /></button>}
      {onCopiar  && <button onClick={onCopiar}  className="rounded p-1 text-orange-400 hover:bg-orange-50"><Copy  className="h-3.5 w-3.5" /></button>}
      {onEditar  && <button onClick={onEditar}  className="rounded p-1 text-blue-500 hover:bg-blue-50"><Pencil  className="h-3.5 w-3.5" /></button>}
      {onEliminar && <button onClick={onEliminar} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function InventarioPage() {
  const [tab, setTab]         = useState<Tab>("productos");
  const [busqueda, setBusqueda] = useState("");
  const rol = useAuthStore((s) => s.rol);
  // vendedor solo puede ver — no puede agregar/editar/eliminar productos, proveedores ni categorías
  const puedeEditar = puedeAcceder(rol, "inventario_editar");

  // Datos del servidor
  const [productos, setProductos]   = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [unidades, setUnidades]     = useState<UnidadMedida[]>([]);
  const [almacenes, setAlmacenes]   = useState<Almacen[]>([]);
  const [loading, setLoading]       = useState(true);
  const [stockInicial, setStockInicial] = useState<number>(0);

  // Estado modales ver / clonar
  const [verModal, setVerModal]         = useState<{ open: boolean; item: Producto | null }>({ open: false, item: null });
  const [clonarModal, setClonarModal]   = useState<{ open: boolean; item: Producto | null }>({ open: false, item: null });
  const [clonarForm, setClonarForm]     = useState<Partial<ProductoIn>>({});
  const [stockClon, setStockClon]       = useState<number>(0);

  // Estado de imagen
  const [imgPreview, setImgPreview]     = useState<string | null>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const imgInputRef = React.useRef<HTMLInputElement>(null);

  // Estado de modales
  const [productoModal, setProductoModal]   = useState<{ open: boolean; item: Producto | null }>({ open: false, item: null });
  const [proveedorModal, setProveedorModal] = useState<{ open: boolean; item: Proveedor | null }>({ open: false, item: null });
  const [clienteModal, setClienteModal]     = useState<{ open: boolean; item: Cliente | null }>({ open: false, item: null });
  const [categoriaModal, setCategoriaModal] = useState<{ open: boolean; item: Categoria | null }>({ open: false, item: null });
  const [deleteModal, setDeleteModal]       = useState<{ open: boolean; nombre: string; action: (() => Promise<void>) | null }>({ open: false, nombre: "", action: null });
  const [saving, setSaving] = useState(false);

  // Form state — producto
  const [pForm, setPForm] = useState<Partial<ProductoIn>>({});
  // Form state — proveedor
  const [provForm, setProvForm] = useState<Partial<ProveedorIn>>({});
  // Form state — cliente
  const [cliForm, setCliForm] = useState<Partial<ClienteIn>>({});
  // Form state — categoría
  const [catForm, setCatForm] = useState<Partial<CategoriaIn>>({});

  // ── Carga inicial ─────────────────────────────────────────────────────────
  const exportarCSV = () => {
    const headers = [
      "CANTIDAD", "STOCK MÍNIMO", "UNIDAD",
      "CÓDIGO MARCA", "CÓDIGO UNIVERSAL", "DESCRIPCIÓN", "MARCA", "PROCEDENCIA",
      "COSTO COMPRA UNITARIO", "COSTO COMPRA CAJA",
      "PRECIO FACTURA", "PRECIO POR MAYOR", "PRECIO TALLER", "PRECIO MAYORISTA",
      "CATEGORÍA", "INDUSTRIA", "MOTOR", "MODELO", "MEDIDA", "PROVEEDOR",
    ];
    // Strings siempre entre comillas (maneja comas y caracteres especiales)
    const str = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    // Números sin comillas para que Excel los reconozca como valores numéricos
    const num = (v: unknown) => {
      const n = parseFloat(String(v ?? ""));
      return isNaN(n) ? "" : String(n);
    };

    const SEP = ";";
    const rows = filtroProd.map(p => [
      Math.round(Number(p.stock_total ?? 0)),
      Math.round(parseFloat(p.stock_minimo)),
      str(unidades.find(u => u.id === p.unidad_id)?.codigo ?? ""),
      str(p.sku),
      str(p.codigo_universal ?? ""),
      str(p.nombre),
      str(p.marca ?? ""),
      str(p.procedencia ?? ""),
      num(p.precio_compra),
      num(p.costo_caja),
      num(p.precio_venta),
      num(p.precio_mayor),
      num(p.precio_mecanico),
      num(p.precio_real),
      str(categorias.find(c => c.id === p.categoria_id)?.nombre ?? ""),
      str(p.industria ?? ""),
      str(p.motor ?? ""),
      str(p.modelos ?? ""),
      str(p.medidas ?? ""),
      str(proveedores.find(pv => pv.id === p.proveedor_id)?.razon_social ?? ""),
    ].join(SEP));

    // sep= le dice a Excel qué separador usar (necesario en locales en español)
    const csv = "﻿" + `sep=${SEP}\r\n` + [headers.map(str).join(SEP), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cargarProductos = async () => {
    const r = await inventarioApi.listProductos({ page_size: 200 });
    setProductos(r.items);
  };
  const cargarProveedores = async () => {
    const r = await inventarioApi.listProveedores({ page_size: 200 });
    setProveedores(r.items);
  };
  const cargarClientes = async () => {
    const r = await inventarioApi.listClientes({ page_size: 200 });
    setClientes(r.items);
  };
  const cargarCategorias = async () => {
    // false = traer todas (activas + inactivas) para gestión
    const r = await inventarioApi.listCategorias(false);
    setCategorias(r);
  };

  useEffect(() => {
    Promise.all([
      cargarProductos(),
      cargarProveedores(),
      cargarClientes(),
      cargarCategorias(),
      inventarioApi.listUnidades().then(setUnidades),
      inventarioApi.listAlmacenes().then(setAlmacenes),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stockBajo    = productos.filter((p) => { const s = Number(p.stock_total ?? 0); return s > 0 && s < parseFloat(p.stock_minimo); }).length;
  const stockCritico = productos.filter((p) => Number(p.stock_total ?? 0) === 0).length;
  const inactivos    = productos.filter((p) => !p.activo).length;

  const STATS_BAR = [
    { label: "Total Productos", value: productos.length,    sub: "",                      color: "text-slate-800" },
    { label: "Stock Bajo",      value: stockBajo,           sub: "Requieren reposición",  color: "text-orange-500" },
    { label: "Stock Crítico",   value: stockCritico,        sub: "Sin existencias",       color: "text-red-500" },
    { label: "Categorías",      value: categorias.filter(c => c.activo).length, sub: "", color: "text-violet-600" },
    { label: "Proveedores",     value: proveedores.length,  sub: "",                      color: "text-teal-600" },
    { label: "Clientes",        value: clientes.length,     sub: "",                      color: "text-indigo-600" },
  ];

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtroProd = productos.filter((p) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    const catNombre = categorias.find(c => c.id === p.categoria_id)?.nombre ?? "";
    const provNombre = proveedores.find(pv => pv.id === p.proveedor_id)?.razon_social ?? "";
    return (
      p.sku.toLowerCase().includes(q) ||
      (p.codigo_universal ?? "").toLowerCase().includes(q) ||
      p.nombre.toLowerCase().includes(q) ||
      (p.marca ?? "").toLowerCase().includes(q) ||
      (p.procedencia ?? "").toLowerCase().includes(q) ||
      (p.motor ?? "").toLowerCase().includes(q) ||
      (p.modelos ?? "").toLowerCase().includes(q) ||
      catNombre.toLowerCase().includes(q) ||
      (p.industria ?? "").toLowerCase().includes(q) ||
      (p.medidas ?? "").toLowerCase().includes(q) ||
      provNombre.toLowerCase().includes(q)
    );
  });
  const filtroProv = proveedores.filter((p) =>
    p.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.ciudad ?? "").toLowerCase().includes(busqueda.toLowerCase()),
  );
  const filtroCli = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.nit ?? "").includes(busqueda),
  );
  const filtroCat = categorias.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  // ── Helpers de apertura de modales ───────────────────────────────────────
  const abrirNuevoProducto = () => {
    setPForm({ controla_stock: true, activo: true });
    setStockInicial(0);
    setImgPreview(null);
    setProductoModal({ open: true, item: null });
  };
  const abrirEditarProducto = (p: Producto) => {
    setPForm({
      nombre: p.nombre, descripcion: p.descripcion ?? "",
      precio_compra: p.precio_compra, precio_venta: p.precio_venta,
      precio_mecanico: p.precio_mecanico ?? undefined,
      precio_mayor: p.precio_mayor ?? undefined,
      precio_real: p.precio_real ?? undefined,
      costo_caja: p.costo_caja ?? undefined,
      stock_minimo: Math.round(parseFloat(p.stock_minimo)),
      marca: p.marca ?? undefined,
      ubicacion: p.ubicacion ?? undefined, aplicacion: p.aplicacion ?? undefined,
      medidas: p.medidas ?? undefined, modelos: p.modelos ?? undefined,
      anio_desde: p.anio_desde ?? undefined, anio_hasta: p.anio_hasta ?? undefined,
      proveedor_id: p.proveedor_id ?? undefined,
      categoria_id: p.categoria_id ?? undefined,
      controla_stock: p.controla_stock, activo: p.activo,
      peso: p.peso ?? undefined,
      codigo_universal: p.codigo_universal ?? undefined,
      procedencia: p.procedencia ?? undefined,
      industria: p.industria ?? undefined,
      motor: p.motor ?? undefined,
    });
    setStockInicial(Math.round(p.stock_total ?? 0));   // pre-carga el stock actual
    setImgPreview(p.imagen_url ?? null);               // pre-carga imagen existente
    setProductoModal({ open: true, item: p });
  };

  const abrirVerProducto = (p: Producto) => setVerModal({ open: true, item: p });

  const abrirClonarProducto = (p: Producto) => {
    setClonarForm({
      sku: `${p.sku}-COPIA`,
      nombre: `${p.nombre} (Copia)`,
      descripcion: p.descripcion ?? undefined,
      precio_compra: p.precio_compra,
      precio_venta: p.precio_venta,
      precio_mecanico: p.precio_mecanico ?? undefined,
      precio_mayor: p.precio_mayor ?? undefined,
      precio_real: p.precio_real ?? undefined,
      costo_caja: p.costo_caja ?? undefined,
      stock_minimo: Math.round(parseFloat(p.stock_minimo)),
      marca: p.marca ?? undefined,
      ubicacion: p.ubicacion ?? undefined,
      aplicacion: p.aplicacion ?? undefined,
      medidas: p.medidas ?? undefined,
      modelos: p.modelos ?? undefined,
      anio_desde: p.anio_desde ?? undefined,
      anio_hasta: p.anio_hasta ?? undefined,
      proveedor_id: p.proveedor_id ?? undefined,
      categoria_id: p.categoria_id ?? undefined,
      controla_stock: p.controla_stock,
      activo: true,
      peso: p.peso ?? undefined,
      unidad_id: p.unidad_id,
      codigo_universal: p.codigo_universal ?? undefined,
      procedencia: p.procedencia ?? undefined,
      industria: p.industria ?? undefined,
      motor: p.motor ?? undefined,
    });
    setStockClon(Math.round(Number(p.stock_total ?? 0)));
    setClonarModal({ open: true, item: p });
  };

  const abrirNuevoProveedor = () => {
    setProvForm({});
    setProveedorModal({ open: true, item: null });
  };
  const abrirEditarProveedor = (p: Proveedor) => {
    setProvForm({
      razon_social: p.razon_social, codigo: p.codigo ?? undefined,
      nombre_contacto: p.nombre_contacto ?? undefined, email: p.email ?? undefined,
      telefono: p.telefono ?? undefined, celular: p.celular ?? undefined,
      direccion: p.direccion ?? undefined, ciudad: p.ciudad ?? undefined,
      pais: p.pais ?? "BO",
      nit: p.nit ?? undefined, categoria: p.categoria, notas: p.notas ?? undefined,
      activo: p.activo,
    });
    setProveedorModal({ open: true, item: p });
  };

  const abrirNuevoCliente = () => {
    setCliForm({});
    setClienteModal({ open: true, item: null });
  };
  const abrirEditarCliente = (c: Cliente) => {
    setCliForm({
      nombre: c.nombre, tipo: c.tipo, email: c.email ?? undefined,
      telefono: c.telefono ?? undefined, celular: c.celular ?? undefined,
      direccion: c.direccion ?? undefined, ciudad: c.ciudad ?? undefined,
      nit: c.nit ?? undefined,
      descuento_pct: parseFloat(c.descuento_pct) || 0,
      activo: c.activo,
    });
    setClienteModal({ open: true, item: c });
  };

  // ── Guardar producto ──────────────────────────────────────────────────────
  const handleGuardarProducto = async () => {
    if (!pForm.sku && !productoModal.item) return;
    setSaving(true);
    try {
      if (productoModal.item) {
        await inventarioApi.updateProducto(productoModal.item.id, pForm);
        // Ajustar stock si el administrador lo cambió
        const stockAnterior = Math.round(productoModal.item.stock_total ?? 0);
        const delta = stockInicial - stockAnterior;
        if (delta !== 0 && almacenes.length > 0) {
          await inventarioApi.ajustarStock({
            producto_id: productoModal.item.id,
            almacen_id: almacenes[0].id,
            tipo: delta > 0 ? "entrada" : "salida",
            cantidad: Math.abs(delta),
            costo_unitario: parseFloat(String(pForm.precio_compra ?? productoModal.item.precio_compra)) || 0,
            motivo: "Ajuste manual desde formulario de producto",
          });
        }
      } else {
        if (!unidades.length) { alert("Crea al menos una unidad de medida primero."); return; }
        const nuevo = await inventarioApi.createProducto({ ...pForm, unidad_id: unidades[0].id } as ProductoIn);
        // Registrar stock inicial si se indicó
        if (stockInicial > 0 && almacenes.length > 0) {
          await inventarioApi.ajustarStock({
            producto_id: nuevo.id,
            almacen_id: almacenes[0].id,
            tipo: "entrada",
            cantidad: stockInicial,
            costo_unitario: parseFloat(String(pForm.precio_compra)) || 0,
            motivo: "Stock inicial al crear producto",
          });
        }
      }
      await cargarProductos();
      setProductoModal({ open: false, item: null });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Guardar clon ─────────────────────────────────────────────────────────
  const handleGuardarClon = async () => {
    if (!clonarForm.sku?.trim()) return;
    setSaving(true);
    try {
      if (!unidades.length) { alert("Crea al menos una unidad de medida primero."); return; }
      const nuevo = await inventarioApi.createProducto({
        ...clonarForm,
        unidad_id: clonarForm.unidad_id ?? unidades[0].id,
      } as ProductoIn);
      if (stockClon > 0 && almacenes.length > 0) {
        await inventarioApi.ajustarStock({
          producto_id: nuevo.id,
          almacen_id: almacenes[0].id,
          tipo: "entrada",
          cantidad: stockClon,
          costo_unitario: parseFloat(String(clonarForm.precio_compra)) || 0,
          motivo: `Stock inicial al clonar desde ${clonarModal.item?.nombre ?? ""}`,
        });
      }
      await cargarProductos();
      setClonarModal({ open: false, item: null });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Subir imagen de producto ──────────────────────────────────────────────
  const handleImagenSeleccionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !productoModal.item) return;
    // Preview local inmediato
    const localUrl = URL.createObjectURL(file);
    setImgPreview(localUrl);
    setImgUploading(true);
    try {
      const { imagen_url } = await inventarioApi.uploadImagenProducto(productoModal.item.id, file);
      setImgPreview(imagen_url);
      setPForm((f) => ({ ...f, imagen_url }));
      await cargarProductos();
    } catch (err) {
      console.error("Error subiendo imagen:", err);
      setImgPreview(productoModal.item.imagen_url ?? null);
    } finally {
      setImgUploading(false);
    }
  };

  // ── Guardar proveedor ─────────────────────────────────────────────────────
  const handleGuardarProveedor = async () => {
    if (!provForm.razon_social) return;
    setSaving(true);
    try {
      if (proveedorModal.item) {
        await inventarioApi.updateProveedor(proveedorModal.item.id, provForm);
      } else {
        await inventarioApi.createProveedor(provForm as ProveedorIn);
      }
      await cargarProveedores();
      setProveedorModal({ open: false, item: null });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Guardar cliente ───────────────────────────────────────────────────────
  const handleGuardarCliente = async () => {
    if (!cliForm.nombre) return;
    setSaving(true);
    try {
      if (clienteModal.item) {
        await inventarioApi.updateCliente(clienteModal.item.id, cliForm);
      } else {
        await inventarioApi.createCliente({ nombre: "", tipo: "particular", ...cliForm } as ClienteIn);
      }
      await cargarClientes();
      setClienteModal({ open: false, item: null });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Eliminar (genérico) ───────────────────────────────────────────────────
  const confirmarEliminar = (nombre: string, action: () => Promise<void>) => {
    setDeleteModal({ open: true, nombre, action });
  };
  const handleEliminar = async () => {
    if (!deleteModal.action) return;
    setSaving(true);
    try {
      await deleteModal.action();
      await Promise.all([cargarProductos(), cargarProveedores(), cargarClientes(), cargarCategorias()]);
      setDeleteModal({ open: false, nombre: "", action: null });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Abrir/guardar Categoría ──────────────────────────────────────────────
  const abrirNuevaCategoria = () => {
    setCatForm({ nombre: "", orden: 0 });
    setCategoriaModal({ open: true, item: null });
  };
  const abrirEditarCategoria = (c: Categoria) => {
    setCatForm({ nombre: c.nombre, parent_id: c.parent_id ?? undefined, orden: c.orden });
    setCategoriaModal({ open: true, item: c });
  };
  const handleGuardarCategoria = async () => {
    if (!catForm.nombre?.trim()) return;
    setSaving(true);
    try {
      if (categoriaModal.item) {
        await inventarioApi.updateCategoria(categoriaModal.item.id, catForm);
      } else {
        await inventarioApi.createCategoria({ nombre: catForm.nombre, parent_id: catForm.parent_id ?? null, orden: catForm.orden ?? 0 });
      }
      await cargarCategorias();
      setCategoriaModal({ open: false, item: null });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400 text-sm">Cargando inventario…</div>;
  }

  return (
    <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 80px)" }}>
      {/* Stats bar */}
      <div className="shrink-0 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STATS_BAR.map((s) => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="px-3 py-2">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              {s.sub && <p className="text-[10px] text-slate-400">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 px-5 pt-1">
          {(["productos", "proveedores", "clientes", "categorias"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { productos: "Productos", proveedores: "Proveedores", clientes: "Clientes", categorias: "Categorías" };
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setBusqueda(""); }}
                className={`-mb-px mr-6 border-b-2 py-3 text-sm font-medium transition-colors ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={tab === "productos" ? "Buscar por código, descripción, marca, procedencia, motor, modelo, categoría, industria, medida, proveedor…" : tab === "proveedores" ? "Buscar por nombre o ciudad…" : tab === "clientes" ? "Buscar por nombre o NIT…" : "Buscar por nombre de categoría…"}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          {/* Exportar CSV — solo en tab productos */}
          {tab === "productos" && filtroProd.length > 0 && (
            <Button
              variant="outline"
              onClick={exportarCSV}
              className="gap-1.5 text-sm border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              title="Exportar inventario actual a Excel/CSV"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          )}
          {/* Botón Agregar: visible para todos en clientes, solo para quienes pueden editar en el resto */}
          {(puedeEditar || tab === "clientes") && (
            <Button
              onClick={tab === "productos" ? abrirNuevoProducto : tab === "proveedores" ? abrirNuevoProveedor : tab === "clientes" ? abrirNuevoCliente : abrirNuevaCategoria}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
            >
              <Plus className="h-4 w-4" />
              {tab === "productos" ? "Agregar Producto" : tab === "proveedores" ? "Agregar Proveedor" : tab === "clientes" ? "Agregar Cliente" : "Agregar Categoría"}
            </Button>
          )}
        </div>

        {/* ── Tab: Productos ── */}
        {tab === "productos" && (
          filtroProd.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <Search className="h-10 w-10 mb-3" />
              <p className="text-sm">{busqueda ? "Sin resultados para tu búsqueda" : "Aún no hay productos. ¡Agrega el primero!"}</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              {puedeEditar ? (
                /* ── TABLA ADMINISTRADOR (19 columnas) ── */
                <table className="border-collapse text-[11px]" style={{ minWidth: "max-content", width: "100%" }}>
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {["CANTIDAD", "STOCK MÍNIMO", "UNIDAD", "CÓDIGO MARCA", "CÓDIGO UNIVERSAL", "DESCRIPCIÓN", "MARCA", "PROCEDENCIA",
                        "COSTO COMPRA UNITARIO", "COSTO COMPRA CAJA", "PRECIO FACTURA", "PRECIO POR MAYOR", "PRECIO TALLER", "PRECIO MAYORISTA",
                        "CATEGORÍA", "INDUSTRIA", "MODELO", "MEDIDA", "PROVEEDOR", "ACCIONES"].map((h) => (
                        <th key={h} className="border border-amber-500 bg-amber-400 px-2 py-2 text-center font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtroProd.map((p, idx) => {
                      const catNombre = categorias.find(c => c.id === p.categoria_id)?.nombre ?? "—";
                      const provNombre = proveedores.find(pv => pv.id === p.proveedor_id)?.razon_social ?? "—";
                      const unidCodigo = unidades.find(u => u.id === p.unidad_id)?.codigo ?? "—";
                      const stockNum = Math.round(Number(p.stock_total ?? 0));
                      const minNum = Math.round(parseFloat(p.stock_minimo));
                      const stockColor = stockNum === 0 ? "text-red-600 font-bold" : stockNum < minNum ? "text-orange-500 font-bold" : "text-slate-800 font-semibold";
                      const rowBg = idx % 2 === 0 ? "bg-white" : "bg-amber-50/40";
                      return (
                        <tr key={p.id} className={`${rowBg} hover:bg-amber-100/60 ${!p.activo ? "opacity-50" : ""}`}>
                          <td className={`border border-slate-200 px-2 py-1 text-center font-mono ${stockColor}`}>{stockNum}</td>
                          <td className="border border-slate-200 px-2 py-1 text-center font-mono text-slate-500">{minNum}</td>
                          <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{unidCodigo}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-indigo-700 font-semibold whitespace-nowrap">{p.sku}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-slate-500 whitespace-nowrap">{p.codigo_universal ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 max-w-[200px]">
                            <p className="font-semibold text-slate-800 truncate leading-tight">{p.nombre}</p>
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 whitespace-nowrap">{p.marca ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 whitespace-nowrap">{p.procedencia ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right text-slate-700 whitespace-nowrap">{fmtBs(p.precio_compra)}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right text-slate-500 whitespace-nowrap">{p.costo_caja ? fmtBs(p.costo_caja) : "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtBs(p.precio_venta)}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right text-slate-700 whitespace-nowrap">{p.precio_mayor ? fmtBs(p.precio_mayor) : "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right text-slate-700 whitespace-nowrap">{p.precio_mecanico ? fmtBs(p.precio_mecanico) : "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right text-blue-700 font-semibold whitespace-nowrap">{p.precio_real ? fmtBs(p.precio_real) : "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 whitespace-nowrap">{catNombre}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 whitespace-nowrap">{p.industria ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-500 max-w-[140px] truncate">{p.modelos ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-500 whitespace-nowrap">{p.medidas ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 whitespace-nowrap max-w-[130px] truncate">{provNombre}</td>
                          <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">
                            <AccionesBtn
                              onVer={() => abrirVerProducto(p)}
                              onCopiar={() => abrirClonarProducto(p)}
                              onEditar={() => abrirEditarProducto(p)}
                              onEliminar={() => confirmarEliminar(p.nombre, () => inventarioApi.deleteProducto(p.id).then(cargarProductos))}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                /* ── TABLA VENDEDOR (15 columnas) ── */
                <table className="border-collapse text-[11px]" style={{ minWidth: "max-content", width: "100%" }}>
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {["CANTIDAD", "STOCK MÍNIMO", "CÓDIGO MARCA", "CÓDIGO UNIVERSAL", "DESCRIPCIÓN", "MARCA",
                        "PROCEDENCIA", "UNIDAD", "PRECIO FACTURA", "PRECIO POR MAYOR", "PRECIO TALLER", "PRECIO MAYORISTA",
                        "MOTOR", "MODELO", "UBICACIÓN", "VER"].map((h) => (
                        <th key={h} className="border border-amber-500 bg-amber-400 px-2 py-2 text-center font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtroProd.map((p, idx) => {
                      const unidCodigo = unidades.find(u => u.id === p.unidad_id)?.codigo ?? "—";
                      const stockNum = Math.round(Number(p.stock_total ?? 0));
                      const minNum = Math.round(parseFloat(p.stock_minimo));
                      const stockColor = stockNum === 0 ? "text-red-600 font-bold" : stockNum < minNum ? "text-orange-500 font-bold" : "text-slate-800 font-semibold";
                      const rowBg = idx % 2 === 0 ? "bg-white" : "bg-amber-50/40";
                      return (
                        <tr key={p.id} className={`${rowBg} hover:bg-amber-100/60 ${!p.activo ? "opacity-50" : ""}`}>
                          <td className={`border border-slate-200 px-2 py-1 text-center font-mono ${stockColor}`}>{stockNum}</td>
                          <td className="border border-slate-200 px-2 py-1 text-center font-mono text-slate-500">{minNum}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-indigo-700 font-semibold whitespace-nowrap">{p.sku}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-slate-500 whitespace-nowrap">{p.codigo_universal ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 max-w-[200px]">
                            <p className="font-semibold text-slate-800 truncate leading-tight">{p.nombre}</p>
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 whitespace-nowrap">{p.marca ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 whitespace-nowrap">{p.procedencia ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{unidCodigo}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtBs(p.precio_venta)}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right text-slate-700 whitespace-nowrap">{p.precio_mayor ? fmtBs(p.precio_mayor) : "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right text-slate-700 whitespace-nowrap">{p.precio_mecanico ? fmtBs(p.precio_mecanico) : "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-right text-blue-700 font-semibold whitespace-nowrap">{p.precio_real ? fmtBs(p.precio_real) : "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 whitespace-nowrap">{p.motor ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-500 max-w-[140px] truncate">{p.modelos ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-500 whitespace-nowrap">{p.ubicacion ?? "—"}</td>
                          <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">
                            <AccionesBtn onVer={() => abrirVerProducto(p)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        )}

        {/* ── Tab: Proveedores ── */}
        {tab === "proveedores" && (
          filtroProv.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <User className="h-10 w-10 mb-3" />
              <p className="text-sm">{busqueda ? "Sin resultados" : "Aún no hay proveedores"}</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto p-5 grid gap-4 sm:grid-cols-2 content-start">
              {filtroProv.map((p) => {
                const numProductos = productos.filter((pr) => pr.proveedor_id === p.id).length;
                return (
                  <Card key={p.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 leading-tight">{p.razon_social}</p>
                            {p.nit && <p className="text-xs text-slate-400 mt-0.5">RUC: {p.nit}</p>}
                          </div>
                        </div>
                        <EstadoBadge activo={p.activo} />
                      </div>

                      {/* Info */}
                      <div className="space-y-2 text-xs text-slate-600">
                        {(p.direccion || p.ciudad) && (
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="text-blue-500">
                              {p.direccion}{p.ciudad ? `, ${p.ciudad}` : ""}
                              {p.pais && p.pais !== "BO" ? `, ${p.pais}` : ""}
                            </span>
                          </div>
                        )}
                        {(p.telefono || p.celular) && (
                          <div className="flex items-start gap-2">
                            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <div>
                              {p.telefono && <p>{p.telefono}</p>}
                              {p.celular && <p>{p.celular}</p>}
                            </div>
                          </div>
                        )}
                        {p.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-blue-500">{p.email}</span>
                          </div>
                        )}
                        {p.nombre_contacto && (
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>Representante: {p.nombre_contacto}</span>
                          </div>
                        )}
                        {p.notas && (
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                            <span>{p.notas}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
                        <div className="space-y-1">
                          {p.categoria && (
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Categorías de productos:</p>
                              <p className="text-xs text-blue-500 font-medium">{p.categoria}</p>
                            </div>
                          )}
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">{numProductos}</span> productos
                          </p>
                        </div>
                        <AccionesBtn
                          onEditar={puedeEditar ? () => abrirEditarProveedor(p) : undefined}
                          onEliminar={puedeEditar ? () => confirmarEliminar(p.razon_social, () => inventarioApi.deleteProveedor(p.id).then(cargarProveedores)) : undefined}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* ── Tab: Clientes ── */}
        {tab === "clientes" && (
          filtroCli.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <User className="h-10 w-10 mb-3" />
              <p className="text-sm">{busqueda ? "Sin resultados" : "Aún no hay clientes"}</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm border-collapse [&_td]:border [&_td]:border-slate-200">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {["CLIENTE", "NIT / RUC", "TIPO", "CONTACTO", "CIUDAD", "DESCUENTO", "ESTADO", "ACCIONES"].map((h) => (
                      <th key={h} className="border border-amber-500 bg-amber-400 px-3 py-2 text-left font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtroCli.map((c, idx) => (
                    <tr key={c.id} className={idx % 2 === 0 ? "bg-white hover:bg-amber-100/60" : "bg-amber-50/40 hover:bg-amber-100/60"}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{c.nombre}</p>
                        {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{c.nit ?? "—"}</td>
                      <td className="px-4 py-3"><TipoBadge tipo={c.tipo} /></td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {c.telefono && <p>{c.telefono}</p>}
                        {c.celular && <p className="text-slate-400">📱 {c.celular}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{c.ciudad ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{parseFloat(c.descuento_pct) > 0 ? `${parseFloat(c.descuento_pct)}%` : "—"}</td>
                      <td className="px-4 py-3"><EstadoBadge activo={c.activo} /></td>
                      <td className="px-4 py-3">
                        <AccionesBtn
                          onEditar={() => abrirEditarCliente(c)}
                          onEliminar={() => confirmarEliminar(c.nombre, () => inventarioApi.deleteCliente(c.id).then(cargarClientes))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── Tab: Categorías ── */}
        {tab === "categorias" && (
          filtroCat.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <FolderOpen className="h-10 w-10 mb-3" />
              <p className="text-sm">{busqueda ? "Sin resultados" : "Aún no hay categorías. ¡Crea la primera!"}</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm border-collapse [&_td]:border [&_td]:border-slate-200">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {["NOMBRE", "CATEGORÍA PADRE", "ORDEN", "PRODUCTOS", "ESTADO", "ACCIONES"].map((h) => (
                      <th key={h} className="border border-amber-500 bg-amber-400 px-3 py-2 text-left font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtroCat.map((c, idx) => {
                    const padre = categorias.find((p) => p.id === c.parent_id);
                    const numProductos = productos.filter((p) => p.categoria_id === c.id).length;
                    return (
                      <tr key={c.id} className={idx % 2 === 0 ? "bg-white hover:bg-amber-100/60" : "bg-amber-50/40 hover:bg-amber-100/60"}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                              <FolderOpen className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-semibold text-slate-800">{c.nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{padre?.nombre ?? <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono">{c.orden}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {numProductos} prod.
                          </span>
                        </td>
                        <td className="px-4 py-3"><EstadoBadge activo={c.activo} /></td>
                        <td className="px-4 py-3">
                          <AccionesBtn
                            onEditar={puedeEditar ? () => abrirEditarCategoria(c) : undefined}
                            onEliminar={puedeEditar ? () => confirmarEliminar(c.nombre, () => inventarioApi.deleteCategoria(c.id).then(cargarCategorias)) : undefined}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ── Modal Producto ── */}
      <Dialog open={productoModal.open} onOpenChange={(o) => !o && setProductoModal({ open: false, item: null })}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {productoModal.item ? "Editar Producto" : "Agregar Producto"}
                </DialogTitle>
                <p className="text-xs text-slate-400">
                  SKU: <span className="font-mono text-indigo-500">{productoModal.item?.sku ?? "Nuevo"}</span>
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="py-3 space-y-5">
            {/* Layout 2 columnas: imagen+estado izq, info+precios der */}
            <div className="grid grid-cols-3 gap-5">
              {/* Columna izquierda */}
              <div className="space-y-4">
                {/* Imagen */}
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Imagen del Producto</Label>
                  {/* Input oculto — se activa con el click del área */}
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImagenSeleccionada}
                  />
                  <div
                    onClick={() => productoModal.item && imgInputRef.current?.click()}
                    className={`mt-1 relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden transition-colors
                      ${productoModal.item ? "cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30" : "cursor-not-allowed opacity-50"}
                      ${imgUploading ? "animate-pulse" : ""}`}
                    style={{ minHeight: "9rem" }}
                  >
                    {imgPreview ? (
                      <>
                        <img src={imgPreview} alt="preview" className="w-full h-36 object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <ImageIcon className="h-6 w-6 text-white mb-1" />
                          <p className="text-xs text-white font-medium">Cambiar imagen</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-8 w-8 text-slate-300 mb-2" />
                        <p className="text-xs text-slate-400 text-center px-2">
                          {productoModal.item ? "Haz clic para subir imagen" : "Guarda el producto primero"}
                        </p>
                        <p className="text-[10px] text-slate-300 mt-0.5">JPEG · PNG · WEBP · máx 5 MB</p>
                      </>
                    )}
                    {imgUploading && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <div className="text-xs text-indigo-600 font-medium">Subiendo…</div>
                      </div>
                    )}
                  </div>
                  {/* Fallback: URL manual */}
                  <div className="mt-1.5">
                    <input
                      type="url"
                      placeholder="O pega una URL de imagen…"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={pForm.imagen_url ?? ""}
                      onChange={(e) => {
                        const url = e.target.value;
                        setPForm((f) => ({ ...f, imagen_url: url || undefined }));
                        setImgPreview(url || null);
                      }}
                    />
                  </div>
                </div>
                {/* Estado */}
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Estado del Producto</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={(pForm.activo ?? true) ? "activo" : "inactivo"}
                    onChange={(e) => setPForm((f) => ({ ...f, activo: e.target.value === "activo" }))}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* Columna derecha */}
              <div className="col-span-2 space-y-5">
                {/* Información Básica */}
                <div>
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 mb-3 pb-1.5 border-b border-slate-100">
                    <Info className="h-3.5 w-3.5" /> Información Básica
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {!productoModal.item ? (
                      <>
                        <FieldEdit label="SKU *" value={pForm.sku as string ?? ""} onChange={(v) => setPForm((f) => ({ ...f, sku: v }))} placeholder="FLT-ACE-001" />
                        <div>
                          <Label className="text-xs font-semibold text-slate-600">Unidad *</Label>
                          <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={pForm.unidad_id as string ?? unidades[0]?.id ?? ""}
                            onChange={(e) => setPForm((f) => ({ ...f, unidad_id: e.target.value }))}>
                            {unidades.map((u) => <option key={u.id} value={u.id}>{u.codigo} — {u.nombre}</option>)}
                          </select>
                        </div>
                      </>
                    ) : null}
                    <div className={productoModal.item ? "col-span-2" : "col-span-2"}>
                      <FieldEdit label="Nombre del Producto *" value={pForm.nombre ?? ""} onChange={(v) => setPForm((f) => ({ ...f, nombre: v }))} placeholder="Filtro de Aceite Toyota 3VZ" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600">Categoría</Label>
                      <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={pForm.categoria_id ?? ""}
                        onChange={(e) => setPForm((f) => ({ ...f, categoria_id: e.target.value || undefined }))}>
                        <option value="">— Sin categoría —</option>
                        {categorias.filter((c) => c.activo).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600">Proveedor</Label>
                      <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={pForm.proveedor_id ?? ""}
                        onChange={(e) => setPForm((f) => ({ ...f, proveedor_id: e.target.value || undefined }))}>
                        <option value="">— Sin proveedor —</option>
                        {proveedores.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <FieldEdit label="Aplicación General" value={pForm.aplicacion ?? ""} onChange={(v) => setPForm((f) => ({ ...f, aplicacion: v }))} placeholder="Ej: Compatible con Toyota, Honda, Nissan" />
                    </div>
                    <FieldEdit label="Código Universal" value={pForm.codigo_universal ?? ""} onChange={(v) => setPForm((f) => ({ ...f, codigo_universal: v }))} placeholder="Ej: 90915-YZZD4" />
                    <FieldEdit label="Procedencia" value={pForm.procedencia ?? ""} onChange={(v) => setPForm((f) => ({ ...f, procedencia: v }))} placeholder="Ej: Japón, China, USA" />
                    <div className="col-span-2">
                      <FieldEdit label="Industria" value={pForm.industria ?? ""} onChange={(v) => setPForm((f) => ({ ...f, industria: v }))} placeholder="Ej: Automotriz, Industrial, Agrícola" />
                    </div>
                  </div>
                </div>

                {/* Precios */}
                <div>
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-green-600 mb-3 pb-1.5 border-b border-slate-100">
                    <ShieldCheck className="h-3.5 w-3.5" /> Precios <span className="text-slate-400 font-normal">(Solo visible para Administrador)</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <PrecioField label="Precio Factura" sublabel="(Público general)" value={String(pForm.precio_venta ?? "")} onChange={(v) => setPForm((f) => ({ ...f, precio_venta: v as unknown as number }))} />
                    <PrecioField label="Precio Taller" sublabel="(Mecánicos)" value={String(pForm.precio_mecanico ?? "")} onChange={(v) => setPForm((f) => ({ ...f, precio_mecanico: v as unknown as number }))} />
                    <PrecioField label="Precio Por Mayor" sublabel="(Compras grandes)" value={String(pForm.precio_mayor ?? "")} onChange={(v) => setPForm((f) => ({ ...f, precio_mayor: v as unknown as number }))} />
                    <PrecioField label="Precio Mayorista" sublabel="(Precio real venta)" value={String(pForm.precio_real ?? "")} onChange={(v) => setPForm((f) => ({ ...f, precio_real: v as unknown as number }))} />
                    <PrecioField label="Costo Compra Unitario" sublabel="(Costo interno)" value={String(pForm.precio_compra ?? "")} onChange={(v) => setPForm((f) => ({ ...f, precio_compra: v as unknown as number }))} />
                    <PrecioField label="Costo Compra Caja" sublabel="(Por caja/paquete)" value={String(pForm.costo_caja ?? "")} onChange={(v) => setPForm((f) => ({ ...f, costo_caja: v as unknown as number }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Stock e Inventario — ancho completo */}
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 mb-3 pb-1.5 border-b border-slate-100">
                <Tag className="h-3.5 w-3.5" /> Stock e Inventario
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {/* Stock Actual — siempre editable, enteros */}
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Stock Actual</Label>
                  <Input className="mt-1" type="number" min={0} step={1}
                    value={stockInicial === 0 ? "" : stockInicial}
                    onChange={(e) => setStockInicial(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                    placeholder="0" />
                  {almacenes[0] && (
                    <p className="text-[10px] text-slate-400 mt-0.5">Almacén: {almacenes[0].nombre}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Stock Mínimo</Label>
                  <Input className="mt-1" type="number" min={0} step={1}
                    value={
                      pForm.stock_minimo === undefined || pForm.stock_minimo === "" || Number(pForm.stock_minimo) === 0
                        ? ""
                        : Math.round(parseFloat(String(pForm.stock_minimo)))
                    }
                    onChange={(e) => setPForm((f) => ({ ...f, stock_minimo: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 }))}
                    placeholder="0" />
                </div>
                <FieldEdit label="Ubicación" value={pForm.ubicacion ?? ""} onChange={(v) => setPForm((f) => ({ ...f, ubicacion: v }))} placeholder="A-01" />
              </div>
            </div>

            {/* Detalles Técnicos — ancho completo */}
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 mb-3 pb-1.5 border-b border-slate-100">
                <X className="h-3.5 w-3.5 text-orange-500" /> Detalles Técnicos
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <FieldEdit label="Marca" value={pForm.marca ?? ""} onChange={(v) => setPForm((f) => ({ ...f, marca: v }))} placeholder="Ej: Bosch, NGK, KYB" />
                <FieldEdit label="Motor" value={pForm.motor ?? ""} onChange={(v) => setPForm((f) => ({ ...f, motor: v }))} placeholder="Ej: 1.8L, 2.0L, 4AGE, 2JZ" />
                <FieldEdit label="Peso" value={String(pForm.peso ?? "")} onChange={(v) => setPForm((f) => ({ ...f, peso: v as unknown as number }))} placeholder="Ej: 2.5 kg" />
                <FieldEdit label="Medidas" value={pForm.medidas ?? ""} onChange={(v) => setPForm((f) => ({ ...f, medidas: v }))} placeholder="Ej: Ø76mm x L90mm" />
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Año Compatible</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input type="number" placeholder="Desde" value={pForm.anio_desde ?? ""} onChange={(e) => setPForm((f) => ({ ...f, anio_desde: e.target.value ? parseInt(e.target.value) : undefined }))} />
                    <span className="text-slate-400 text-sm">–</span>
                    <Input type="number" placeholder="Hasta" value={pForm.anio_hasta ?? ""} onChange={(e) => setPForm((f) => ({ ...f, anio_hasta: e.target.value ? parseInt(e.target.value) : undefined }))} />
                  </div>
                </div>
                <div className="col-span-2">
                  <FieldEdit label="Modelos Compatibles" value={pForm.modelos ?? ""} onChange={(v) => setPForm((f) => ({ ...f, modelos: v }))} placeholder="Ej: Toyota Corolla 2008-2023, Yaris 2006-2020" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-semibold text-slate-600">Descripción Detallada</Label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    placeholder="Descripción completa del producto, características, beneficios…"
                    value={pForm.descripcion ?? ""}
                    onChange={(e) => setPForm((f) => ({ ...f, descripcion: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductoModal({ open: false, item: null })}>Cancelar</Button>
            <Button onClick={handleGuardarProducto} disabled={saving || (!productoModal.item && !pForm.sku)} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {saving ? "Guardando…" : productoModal.item ? "Guardar Cambios" : "Guardar Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Proveedor ── */}
      <Dialog open={proveedorModal.open} onOpenChange={(o) => !o && setProveedorModal({ open: false, item: null })}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50">
                <Building2 className="h-5 w-5 text-teal-600" />
              </div>
              <DialogTitle className="text-base">{proveedorModal.item ? "Editar Proveedor" : "Agregar Nuevo Proveedor"}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-3 space-y-5">
            {/* Sección: Empresa */}
            <FormSection icon={<Building2 className="h-3.5 w-3.5" />} title="Información de la Empresa" color="text-teal-600">
              <div className="col-span-2">
                <FieldEdit label="Nombre de la Empresa *" value={provForm.razon_social ?? ""} onChange={(v) => setProvForm((f) => ({ ...f, razon_social: v }))} placeholder="Ej: Repuestos Andinos SA" />
              </div>
              <FieldEdit label="RUC / NIT *" value={provForm.nit ?? ""} onChange={(v) => setProvForm((f) => ({ ...f, nit: v }))} placeholder="Ej: 1792345678001" />
              <div>
                <Label className="text-xs font-semibold text-slate-600">Estado</Label>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={(provForm.activo ?? true) ? "activo" : "inactivo"}
                  onChange={(e) => setProvForm((f) => ({ ...f, activo: e.target.value === "activo" }))}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            </FormSection>

            {/* Sección: Ubicación */}
            <FormSection icon={<MapPin className="h-3.5 w-3.5" />} title="Ubicación" color="text-red-500">
              <div className="col-span-2">
                <FieldEdit label="Dirección Completa *" value={provForm.direccion ?? ""} onChange={(v) => setProvForm((f) => ({ ...f, direccion: v }))} placeholder="Ej: Av. 10 de Agosto N45-123" />
              </div>
              <FieldEdit label="Ciudad *" value={provForm.ciudad ?? ""} onChange={(v) => setProvForm((f) => ({ ...f, ciudad: v }))} placeholder="Ej: Tarija" />
              <div>
                <Label className="text-xs font-semibold text-slate-600">País *</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={provForm.pais ?? "BO"}
                  onChange={(e) => setProvForm((f) => ({ ...f, pais: e.target.value }))}
                >
                  {PAISES_ISO.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </div>
            </FormSection>

            {/* Sección: Contacto */}
            <FormSection icon={<Phone className="h-3.5 w-3.5" />} title="Información de Contacto" color="text-blue-500">
              <FieldEdit label="Teléfono Principal *" value={provForm.telefono ?? ""} onChange={(v) => setProvForm((f) => ({ ...f, telefono: v }))} placeholder="Ej: 04-4123456" />
              <FieldEdit label="Teléfono Secundario" value={provForm.celular ?? ""} onChange={(v) => setProvForm((f) => ({ ...f, celular: v }))} placeholder="Ej: 72001234" />
              <FieldEdit label="Email de Contacto *" type="email" value={provForm.email ?? ""} onChange={(v) => setProvForm((f) => ({ ...f, email: v }))} placeholder="Ej: ventas@proveedor.com" />
              <FieldEdit label="Nombre del Representante *" value={provForm.nombre_contacto ?? ""} onChange={(v) => setProvForm((f) => ({ ...f, nombre_contacto: v }))} placeholder="Ej: Roberto Sánchez" />
            </FormSection>

            {/* Sección: Comercial */}
            <FormSection icon={<CreditCard className="h-3.5 w-3.5" />} title="Información Comercial" color="text-purple-600">
              <div>
                <Label className="text-xs font-semibold text-slate-600">Condiciones de Pago *</Label>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={provForm.notas ?? ""}
                  onChange={(e) => setProvForm((f) => ({ ...f, notas: e.target.value }))}>
                  <option value="">Seleccionar condición</option>
                  <option value="Pago inmediato">Pago inmediato</option>
                  <option value="Crédito 15 días">Crédito 15 días</option>
                  <option value="Crédito 30 días">Crédito 30 días</option>
                  <option value="Crédito 45 días">Crédito 45 días</option>
                  <option value="Crédito 60 días">Crédito 60 días</option>
                  <option value="Crédito 90 días">Crédito 90 días</option>
                </select>
              </div>
              <FieldEdit label="Categorías de Productos *" value={provForm.categoria ?? ""} onChange={(v) => setProvForm((f) => ({ ...f, categoria: v }))} placeholder="Ej: Motor, Filtros, Transmisión" />
            </FormSection>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProveedorModal({ open: false, item: null })}>Cancelar</Button>
            <Button onClick={handleGuardarProveedor} disabled={saving || !provForm.razon_social} className="bg-teal-600 hover:bg-teal-700 gap-1.5">
              {saving ? "Guardando…" : proveedorModal.item ? "Guardar Cambios" : "Guardar Proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Cliente ── */}
      <Dialog open={clienteModal.open} onOpenChange={(o) => !o && setClienteModal({ open: false, item: null })}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                <User className="h-5 w-5 text-indigo-600" />
              </div>
              <DialogTitle className="text-base">{clienteModal.item ? "Editar Cliente" : "Agregar Nuevo Cliente Frecuente"}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-3 space-y-5">
            {/* Información Personal */}
            <FormSection icon={<User className="h-3.5 w-3.5" />} title="Información Personal" color="text-indigo-600">
              <div className="col-span-2">
                <FieldEdit label="Nombre Completo / Razón Social *" value={cliForm.nombre ?? ""} onChange={(v) => setCliForm((f) => ({ ...f, nombre: v }))} placeholder="Ej: Juan Pérez o Taller Mecánico El Experto" />
              </div>
              <FieldEdit label="Cédula / RUC *" value={cliForm.nit ?? ""} onChange={(v) => setCliForm((f) => ({ ...f, nit: v }))} placeholder="Ej: 4512345678" />
              <div>
                <Label className="text-xs font-semibold text-slate-600">Tipo de Cliente *</Label>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={cliForm.tipo ?? ""}
                  onChange={(e) => setCliForm((f) => ({ ...f, tipo: e.target.value as ClienteIn["tipo"] }))}>
                  <option value="">Seleccionar tipo</option>
                  <option value="particular">Particular</option>
                  <option value="mecanico">Mecánico</option>
                  <option value="mayorista">Mayorista</option>
                </select>
              </div>
            </FormSection>

            {/* Contacto */}
            <FormSection icon={<Phone className="h-3.5 w-3.5" />} title="Información de Contacto" color="text-green-600">
              <FieldEdit label="Teléfono *" value={cliForm.telefono ?? ""} onChange={(v) => setCliForm((f) => ({ ...f, telefono: v }))} placeholder="Ej: 04-4123456" />
              <FieldEdit label="WhatsApp" value={cliForm.celular ?? ""} onChange={(v) => setCliForm((f) => ({ ...f, celular: v }))} placeholder="Ej: 72001234" />
              <div className="col-span-2">
                <FieldEdit label="Email *" type="email" value={cliForm.email ?? ""} onChange={(v) => setCliForm((f) => ({ ...f, email: v }))} placeholder="Ej: cliente@email.com" />
              </div>
            </FormSection>

            {/* Ubicación */}
            <FormSection icon={<MapPin className="h-3.5 w-3.5" />} title="Ubicación" color="text-red-500">
              <div className="col-span-2">
                <FieldEdit label="Dirección Completa *" value={cliForm.direccion ?? ""} onChange={(v) => setCliForm((f) => ({ ...f, direccion: v }))} placeholder="Ej: Calle Colón 234" />
              </div>
              <FieldEdit label="Ciudad *" value={cliForm.ciudad ?? ""} onChange={(v) => setCliForm((f) => ({ ...f, ciudad: v }))} placeholder="Ej: Tarija" />
              <div>
                <Label className="text-xs font-semibold text-slate-600">Estado</Label>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={(cliForm.activo ?? true) ? "activo" : "inactivo"}
                  onChange={(e) => setCliForm((f) => ({ ...f, activo: e.target.value === "activo" }))}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            </FormSection>

            {/* Descuentos */}
            <FormSection icon={<CreditCard className="h-3.5 w-3.5" />} title="Configuración de Descuentos" color="text-purple-600">
              <div>
                <Label className="text-xs font-semibold text-slate-600">Descuento Asignado *</Label>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={
                    cliForm.descuento_pct === 0 ? "0" :
                    cliForm.descuento_pct === 5 ? "5" :
                    cliForm.descuento_pct === 7.5 ? "7.5" :
                    cliForm.descuento_pct === 10 ? "10" :
                    cliForm.descuento_pct === 12 ? "12" :
                    cliForm.descuento_pct === 15 ? "15" :
                    cliForm.descuento_pct === 20 ? "20" : "custom"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== "custom") setCliForm((f) => ({ ...f, descuento_pct: parseFloat(val) }));
                  }}>
                  <option value="0">Sin Descuento (0%)</option>
                  <option value="5">Especial 5%</option>
                  <option value="7.5">Mecánico 7.5%</option>
                  <option value="10">Mecánico Plus 10%</option>
                  <option value="12">Mayorista 12%</option>
                  <option value="15">Mayorista Plus 15%</option>
                  <option value="20">VIP 20%</option>
                  <option value="custom">Personalizado…</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">Porcentaje de Descuento</Label>
                <div className="relative mt-1">
                  <Input type="number" min={0} max={100} step={0.5}
                    value={cliForm.descuento_pct ? cliForm.descuento_pct : ""}
                    onChange={(e) => setCliForm((f) => ({ ...f, descuento_pct: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 }))}
                    className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                </div>
              </div>
            </FormSection>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setClienteModal({ open: false, item: null })}>Cancelar</Button>
            <Button onClick={handleGuardarCliente} disabled={saving || !cliForm.nombre} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {saving ? "Guardando…" : clienteModal.item ? "Guardar Cambios" : "Guardar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Categoría ── */}
      <Dialog open={categoriaModal.open} onOpenChange={(o) => !o && setCategoriaModal({ open: false, item: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{categoriaModal.item ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-600">Nombre *</Label>
              <Input
                className="mt-1"
                value={catForm.nombre ?? ""}
                onChange={(e) => setCatForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Filtros, Lubricantes, Frenos…"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">Categoría Padre (opcional)</Label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={catForm.parent_id ?? ""}
                onChange={(e) => setCatForm((f) => ({ ...f, parent_id: e.target.value || null }))}
              >
                <option value="">— Sin padre (categoría raíz) —</option>
                {categorias
                  .filter((c) => c.activo && c.id !== categoriaModal.item?.id)
                  .map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)
                }
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">Orden de visualización</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={catForm.orden ?? 0}
                onChange={(e) => setCatForm((f) => ({ ...f, orden: parseInt(e.target.value) || 0 }))}
              />
            </div>
            {categoriaModal.item && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="cat-activo"
                  type="checkbox"
                  checked={
                    catForm.activo !== undefined
                      ? (catForm.activo as boolean)
                      : categoriaModal.item.activo
                  }
                  onChange={(e) => setCatForm((f) => ({ ...f, activo: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Label htmlFor="cat-activo" className="text-sm text-slate-600">Activa</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriaModal({ open: false, item: null })}>Cancelar</Button>
            <Button onClick={handleGuardarCategoria} disabled={saving || !catForm.nombre?.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Ver Producto ── */}
      <Dialog open={verModal.open} onOpenChange={(o) => !o && setVerModal({ open: false, item: null })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {verModal.item && (() => {
            const p = verModal.item;
            const cat = categorias.find((c) => c.id === p.categoria_id);
            const prov = proveedores.find((v) => v.id === p.proveedor_id);
            const stockNum = Math.round(Number(p.stock_total ?? 0));
            const minNum   = Math.round(parseFloat(p.stock_minimo));
            return (
              <>
                <DialogHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                        <Eye className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <DialogTitle className="text-base font-semibold">Detalle del Producto</DialogTitle>
                        <p className="text-xs text-slate-400 font-mono">SKU: {p.sku}</p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 mr-6"
                      onClick={() => { setVerModal({ open: false, item: null }); abrirEditarProducto(p); }}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                  </div>
                </DialogHeader>

                <div className="py-2 space-y-5">
                  {/* Layout 2 columnas */}
                  <div className="grid grid-cols-3 gap-5">
                    {/* Columna izquierda: imagen + badges */}
                    <div className="space-y-3">
                      <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 aspect-square flex items-center justify-center">
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-14 w-14 text-slate-200" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.activo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          stockNum === 0 ? "bg-red-100 text-red-700"
                          : stockNum < minNum ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"}`}>
                          Stock: {stockNum} uds
                        </span>
                      </div>
                    </div>

                    {/* Columna derecha: info */}
                    <div className="col-span-2 space-y-4">
                      <div>
                        <h2 className="text-xl font-bold text-slate-800 leading-tight">{p.nombre}</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {[p.marca, cat?.nombre].filter(Boolean).join(" · ")}
                        </p>
                      </div>

                      {/* Grid de detalles */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Marca",          value: p.marca },
                          { label: "Peso",           value: p.peso ? `${p.peso} kg` : null },
                          { label: "Proveedor",      value: prov?.razon_social },
                          { label: "Año Compatible", value: p.anio_desde ? `${p.anio_desde} - ${p.anio_hasta ?? "…"}` : null },
                          { label: "SKU",            value: p.sku },
                          { label: "Ubicación",      value: p.ubicacion },
                        ].map(({ label, value }) => value ? (
                          <div key={label} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
                            <p className="text-sm font-semibold text-slate-700 mt-0.5 leading-tight">{value}</p>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  </div>

                  {/* Secciones de texto */}
                  {p.aplicacion && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                        <Tag className="h-3.5 w-3.5" /> Aplicación
                      </p>
                      <p className="text-sm text-slate-700">{p.aplicacion}</p>
                    </div>
                  )}
                  {p.medidas && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 mb-1.5">
                        <Ruler className="h-3.5 w-3.5" /> Medidas y Especificaciones
                      </p>
                      <p className="text-sm text-slate-700">{p.medidas}</p>
                    </div>
                  )}
                  {p.modelos && (
                    <div className="rounded-xl border border-green-100 bg-green-50/40 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-green-600 mb-1.5">
                        <Car className="h-3.5 w-3.5" /> Modelos Compatibles
                      </p>
                      <p className="text-sm text-slate-700">{p.modelos}</p>
                    </div>
                  )}
                  {p.descripcion && (
                    <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 mb-1.5">
                        <BookOpen className="h-3.5 w-3.5" /> Descripción Detallada
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">{p.descripcion}</p>
                    </div>
                  )}

                  {/* Precios */}
                  <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 mb-3">
                      <Gem className="h-3.5 w-3.5" /> Precios (Solo Administrador)
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "Unitario",  sublabel: "Público",    value: fmtBs(p.precio_venta),  bg: "bg-emerald-50  border-emerald-200", text: "text-emerald-700" },
                        { label: "Mecánico",  sublabel: "Con desc.",   value: p.precio_mecanico ? fmtBs(p.precio_mecanico) : "—", bg: "bg-blue-50 border-blue-200",     text: "text-blue-700" },
                        { label: "Por Mayor", sublabel: "Mayorista",   value: p.precio_mayor    ? fmtBs(p.precio_mayor)    : "—", bg: "bg-violet-50 border-violet-200", text: "text-violet-700" },
                        { label: "Costo Real",sublabel: "Interno",     value: fmtBs(p.precio_compra), bg: "bg-slate-50  border-slate-200",   text: "text-slate-700" },
                      ].map(({ label, sublabel, value, bg, text }) => (
                        <div key={label} className={`rounded-xl border p-3 ${bg}`}>
                          <p className="text-[10px] text-slate-400 font-medium">{label}</p>
                          <p className="text-[10px] text-slate-400">{sublabel}</p>
                          <p className={`text-base font-bold mt-1 ${text}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Modal Clonar Producto ── */}
      <Dialog open={clonarModal.open} onOpenChange={(o) => !o && setClonarModal({ open: false, item: null })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
                <Copy className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Clonar Producto</DialogTitle>
                <p className="text-xs text-slate-400">Basado en: <span className="text-orange-500 font-medium">{clonarModal.item?.nombre}</span></p>
              </div>
            </div>
          </DialogHeader>

          {/* Banner de aviso */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">Todos los campos han sido copiados del producto original. Modifica únicamente lo que necesites cambiar antes de guardar.</p>
          </div>

          <div className="space-y-5 py-2">
            {/* Información Básica */}
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 mb-3 pb-1.5 border-b border-slate-100">
                <Info className="h-3.5 w-3.5" /> Información Básica
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <FieldEdit label="SKU *" value={clonarForm.sku ?? ""} onChange={(v) => setClonarForm((f) => ({ ...f, sku: v }))} placeholder="PRODUCTO-001-COPIA" />
                <FieldEdit label="Nombre del Producto *" value={clonarForm.nombre ?? ""} onChange={(v) => setClonarForm((f) => ({ ...f, nombre: v }))} placeholder="Nombre del producto" />
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Categoría</Label>
                  <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={clonarForm.categoria_id ?? ""}
                    onChange={(e) => setClonarForm((f) => ({ ...f, categoria_id: e.target.value || undefined }))}>
                    <option value="">— Sin categoría —</option>
                    {categorias.filter((c) => c.activo).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Proveedor</Label>
                  <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={clonarForm.proveedor_id ?? ""}
                    onChange={(e) => setClonarForm((f) => ({ ...f, proveedor_id: e.target.value || undefined }))}>
                    <option value="">— Sin proveedor —</option>
                    {proveedores.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <FieldEdit label="Aplicación" value={clonarForm.aplicacion ?? ""} onChange={(v) => setClonarForm((f) => ({ ...f, aplicacion: v }))} placeholder="Ej: Compatible con Toyota, Honda…" />
                </div>
              </div>
            </div>

            {/* Gestión de Precios */}
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-green-600 mb-3 pb-1.5 border-b border-slate-100">
                <Gem className="h-3.5 w-3.5" /> Gestión de Precios
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <PrecioField label="Precio Factura" sublabel="(Público general)" value={String(clonarForm.precio_venta ?? "")} onChange={(v) => setClonarForm((f) => ({ ...f, precio_venta: v as unknown as number }))} />
                <PrecioField label="Precio Taller" sublabel="(Mecánicos)" value={String(clonarForm.precio_mecanico ?? "")} onChange={(v) => setClonarForm((f) => ({ ...f, precio_mecanico: v as unknown as number }))} />
                <PrecioField label="Precio Por Mayor" sublabel="(Compras grandes)" value={String(clonarForm.precio_mayor ?? "")} onChange={(v) => setClonarForm((f) => ({ ...f, precio_mayor: v as unknown as number }))} />
                <PrecioField label="Precio Mayorista" sublabel="(Precio real venta)" value={String(clonarForm.precio_real ?? "")} onChange={(v) => setClonarForm((f) => ({ ...f, precio_real: v as unknown as number }))} />
                <PrecioField label="Costo Compra Unitario" sublabel="(Costo interno)" value={String(clonarForm.precio_compra ?? "")} onChange={(v) => setClonarForm((f) => ({ ...f, precio_compra: v as unknown as number }))} />
                <PrecioField label="Costo Compra Caja" sublabel="(Por caja/paquete)" value={String(clonarForm.costo_caja ?? "")} onChange={(v) => setClonarForm((f) => ({ ...f, costo_caja: v as unknown as number }))} />
              </div>
            </div>

            {/* Stock e Inventario */}
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 mb-3 pb-1.5 border-b border-slate-100">
                <Tag className="h-3.5 w-3.5" /> Stock e Inventario
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Stock Actual</Label>
                  <Input className="mt-1" type="number" min={0} step={1}
                    value={stockClon === 0 ? "" : stockClon}
                    onChange={(e) => setStockClon(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                    placeholder="0" />
                  {almacenes[0] && <p className="text-[10px] text-slate-400 mt-0.5">Almacén: {almacenes[0].nombre}</p>}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Stock Mínimo</Label>
                  <Input className="mt-1" type="number" min={0} step={1}
                    value={clonarForm.stock_minimo === undefined || Number(clonarForm.stock_minimo) === 0 ? "" : clonarForm.stock_minimo}
                    onChange={(e) => setClonarForm((f) => ({ ...f, stock_minimo: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 }))}
                    placeholder="0" />
                </div>
                <FieldEdit label="Ubicación" value={clonarForm.ubicacion ?? ""} onChange={(v) => setClonarForm((f) => ({ ...f, ubicacion: v }))} placeholder="A-01" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setClonarModal({ open: false, item: null })}>Cancelar</Button>
            <Button onClick={handleGuardarClon} disabled={saving || !clonarForm.sku?.trim()}
              className="bg-orange-500 hover:bg-orange-600 gap-1.5">
              {saving ? "Guardando…" : <><Copy className="h-4 w-4" /> Guardar Clon</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Eliminar ── */}
      <Dialog open={deleteModal.open} onOpenChange={(o) => !o && setDeleteModal({ open: false, nombre: "", action: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Confirmar eliminación
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            ¿Estás seguro de que quieres eliminar <strong>{deleteModal.nombre}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModal({ open: false, nombre: "", action: null })}>Cancelar</Button>
            <Button onClick={handleEliminar} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Lista de países (código ISO 3166-1 alpha-2 → nombre) ────────────────────
const PAISES_ISO = [
  { code: "BO", name: "Bolivia" },
  { code: "AR", name: "Argentina" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "EC", name: "Ecuador" },
  { code: "PE", name: "Perú" },
  { code: "PY", name: "Paraguay" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "MX", name: "México" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "SV", name: "El Salvador" },
  { code: "NI", name: "Nicaragua" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panamá" },
  { code: "CU", name: "Cuba" },
  { code: "DO", name: "Rep. Dominicana" },
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "España" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japón" },
  { code: "DE", name: "Alemania" },
  { code: "IT", name: "Italia" },
  { code: "FR", name: "Francia" },
  { code: "GB", name: "Reino Unido" },
];

// ─── Helper de campo de formulario ───────────────────────────────────────────
function FieldEdit({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      <Input className="mt-1" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ─── Campo de precio con prefijo Bs ──────────────────────────────────────────
function PrecioField({ label, sublabel, value, onChange }: {
  label: string; sublabel?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-600">
        {label} {sublabel && <span className="font-normal text-slate-400">{sublabel}</span>}
      </Label>
      <div className="relative mt-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">Bs</span>
        <Input type="number" min={0} step={0.01} className="pl-8"
          value={value === "0" || value === "" ? "" : value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

// ─── Sección de formulario con encabezado ─────────────────────────────────────
function FormSection({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className={`flex items-center gap-1.5 text-xs font-semibold mb-3 pb-1.5 border-b border-slate-100 ${color}`}>
        {icon} {title}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {children}
      </div>
    </div>
  );
}
