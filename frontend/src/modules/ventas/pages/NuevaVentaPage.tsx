import {
  ArrowLeft, FileText, ImageIcon, Printer, Search, ShoppingCart, Trash2, X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { authApi } from "@/modules/auth/services/authApi";
import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import { ventasApi } from "@/modules/ventas/services/ventasApi";
import type { Cliente, Cotizacion, EmpresaPerfil, Producto, Venta, VentaIn } from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";
import { bust } from "@/shared/utils/cache";
import { toast } from "sonner";

// ─── Recibo helpers ───────────────────────────────────────────────────────────
const METODOS_PAGO: Record<string, string> = {
  efectivo: "Efectivo", tarjeta_debito: "Tarjeta de Débito",
  tarjeta_credito: "Tarjeta de Crédito", transferencia: "Transferencia", mixto: "Mixto",
};

function EmpresaHeader({ empresa }: { empresa: EmpresaPerfil | null }) {
  const nombre = empresa?.nombre_comercial ?? empresa?.razon_social ?? "AUTOREPUESTOS";
  return (
    <div className="text-center mb-4">
      <p className="font-bold text-base tracking-wide">{nombre.toUpperCase()}</p>
      {empresa?.direccion && <p className="text-xs text-slate-500">{empresa.direccion}</p>}
      {(empresa?.telefono || empresa?.ciudad) && (
        <p className="text-xs text-slate-500">
          {empresa.telefono ? `Tel: ${empresa.telefono}` : ""}
          {empresa.telefono && empresa.ciudad ? " · " : ""}
          {empresa.ciudad ?? ""}
        </p>
      )}
    </div>
  );
}

function ReciboVenta({ venta, empresa }: { venta: Venta; empresa: EmpresaPerfil | null }) {
  const descuento = parseFloat(venta.descuento_monto ?? "0");
  return (
    <div className="font-mono text-xs space-y-1 max-w-[320px] mx-auto" id="print-doc">
      <EmpresaHeader empresa={empresa} />
      <div className="border-t border-dashed border-slate-300 my-3" />
      <p className="text-center font-bold text-sm tracking-widest">RECIBO DE VENTA</p>
      <p className="text-center text-slate-700">No. {venta.numero}</p>
      <p className="text-center text-slate-500">{venta.fecha} {venta.created_at?.slice(11, 16)}</p>
      <div className="border-t border-dashed border-slate-300 my-3" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Cliente:</span>
          <span className="font-medium text-right">{venta.cliente_nombre ?? "Cliente general"}</span>
        </div>
        {venta.cliente_tipo && (
          <div className="flex justify-between">
            <span className="text-slate-500">Tipo:</span>
            <span className="capitalize">{venta.cliente_tipo === "mecanico" ? "Mecánico" : venta.cliente_tipo === "mayorista" ? "Mayorista" : "Particular"}</span>
          </div>
        )}
        {venta.vendedor_nombre && (
          <div className="flex justify-between">
            <span className="text-slate-500">Vendedor:</span>
            <span>{venta.vendedor_nombre}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Pago:</span>
          <span>{METODOS_PAGO[venta.metodo_pago] ?? venta.metodo_pago}</span>
        </div>
      </div>
      <div className="border-t border-dashed border-slate-300 my-3" />
      <div className="flex justify-between font-semibold text-[10px] text-slate-500 pb-1">
        <span>DESCRIPCIÓN</span><span>TOTAL</span>
      </div>
      {venta.items.map((it) => (
        <div key={it.id} className="mb-1.5">
          <div className="flex justify-between">
            <span className="font-medium">{it.nombre}</span>
            <span className="font-semibold">{fmtBs(it.subtotal)}</span>
          </div>
          <p className="text-slate-400">{it.cantidad} × {fmtBs(it.precio_unitario)}</p>
        </div>
      ))}
      <div className="border-t border-dashed border-slate-300 my-3" />
      {descuento > 0 && (
        <>
          <div className="flex justify-between text-slate-500">
            <span>Subtotal:</span><span>{fmtBs(venta.subtotal)}</span>
          </div>
          <div className="flex justify-between text-red-500">
            <span>Descuento ({venta.descuento_pct}%):</span>
            <span>-{fmtBs(venta.descuento_monto)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL A PAGAR:</span><span>{fmtBs(venta.total)}</span>
      </div>
      {parseFloat(venta.cambio ?? "0") > 0 && (
        <div className="flex justify-between text-slate-500">
          <span>Cambio:</span><span>{fmtBs(venta.cambio)}</span>
        </div>
      )}
      <div className="border-t border-dashed border-slate-300 my-3" />
      <p className="text-center font-medium">¡Gracias por su compra!</p>
      <p className="text-center text-slate-400">Este documento no es una factura.</p>
      <p className="text-center text-slate-400">Para factura solicítala al momento de la compra.</p>
    </div>
  );
}

function DocCotizacion({ cot, empresa }: { cot: Cotizacion; empresa: EmpresaPerfil | null }) {
  const descuento = parseFloat(cot.descuento_monto ?? "0");
  const subtotal  = parseFloat(cot.subtotal ?? "0");
  const descPct   = subtotal > 0 ? Math.round((descuento / subtotal) * 100) : 0;
  return (
    <div className="font-mono text-xs space-y-1 max-w-[320px] mx-auto" id="print-doc">
      <EmpresaHeader empresa={empresa} />
      <div className="border-t border-dashed border-slate-300 my-3" />
      <p className="text-center font-bold text-sm tracking-widest">COTIZACIÓN</p>
      <p className="text-center text-slate-700">No. {cot.numero}</p>
      <p className="text-center text-slate-500">{cot.fecha} {cot.created_at?.slice(11, 16)}</p>
      <div className="border-t border-dashed border-slate-300 my-3" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Cliente:</span>
          <span className="font-medium text-right">{cot.cliente_nombre ?? "—"}</span>
        </div>
        {cot.cliente_tipo && (
          <div className="flex justify-between">
            <span className="text-slate-500">Tipo:</span>
            <span className="capitalize">{cot.cliente_tipo === "mecanico" ? "Mecánico" : cot.cliente_tipo === "mayorista" ? "Mayorista" : "Particular"}</span>
          </div>
        )}
        {cot.vendedor_nombre && (
          <div className="flex justify-between">
            <span className="text-slate-500">Vendedor:</span>
            <span>{cot.vendedor_nombre}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Válida hasta:</span>
          <span>{cot.fecha_vence ?? `+${cot.vigencia_dias} días`}</span>
        </div>
      </div>
      <div className="border-t border-dashed border-slate-300 my-3" />
      <div className="flex justify-between font-semibold text-[10px] text-slate-500 pb-1">
        <span>DESCRIPCIÓN</span><span>TOTAL</span>
      </div>
      {cot.items.map((it) => (
        <div key={it.id} className="mb-1.5">
          <div className="flex justify-between">
            <span className="font-medium">{it.nombre}</span>
            <span className="font-semibold">{fmtBs(it.subtotal)}</span>
          </div>
          <p className="text-slate-400">{it.cantidad} × {fmtBs(it.precio_unitario)}</p>
        </div>
      ))}
      <div className="border-t border-dashed border-slate-300 my-3" />
      {descuento > 0 && (
        <>
          <div className="flex justify-between text-slate-500">
            <span>Subtotal:</span><span>{fmtBs(cot.subtotal)}</span>
          </div>
          <div className="flex justify-between text-red-500">
            <span>Descuento ({descPct}%):</span>
            <span>-{fmtBs(cot.descuento_monto)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL:</span><span>{fmtBs(cot.total)}</span>
      </div>
      <div className="border-t border-dashed border-slate-300 my-3" />
      <p className="text-center text-slate-400">Esta cotización no genera compromiso de compra.</p>
    </div>
  );
}

type Modo = "venta" | "cotizacion";

interface CartItem {
  id: string; sku: string; nombre: string;
  precio: number;
  precio_venta: number;
  precio_mayor?: number | null;
  precio_mecanico?: number | null;
  precio_real?: number | null;
  cantidad: number; stock: number;
}

// ─── ClienteSearch (autocomplete + texto libre) ───────────────────────────────
function ClienteSearch({
  clientes, clienteNombre, setClienteNombre,
  setClienteId, setClienteDescuento, setClienteTipo,
}: {
  clientes: Cliente[];
  clienteNombre: string; setClienteNombre: (v: string) => void;
  setClienteId: (v: string | null) => void;
  setClienteDescuento: (v: number) => void;
  setClienteTipo: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtrados = clienteNombre.trim().length >= 1
    ? clientes.filter((c) =>
        c.nombre.toLowerCase().includes(clienteNombre.toLowerCase()) ||
        (c.nit ?? "").toLowerCase().includes(clienteNombre.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const seleccionar = (c: Cliente) => {
    setClienteNombre(c.nombre);
    setClienteId(c.id);
    setClienteTipo(c.tipo);
    setClienteDescuento(parseFloat(c.descuento_pct) || 0);
    setOpen(false);
  };

  const limpiar = () => {
    setClienteNombre(""); setClienteId(null); setClienteTipo(null);
    setClienteDescuento(0); setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          placeholder="Nombre del cliente (registrado o libre)…"
          value={clienteNombre}
          className="pr-7 text-sm"
          onChange={(e) => {
            setClienteNombre(e.target.value);
            setClienteId(null); setClienteTipo(null); setClienteDescuento(0);
            setOpen(true);
          }}
          onFocus={() => { if (clienteNombre.trim()) setOpen(true); }}
        />
        {clienteNombre && (
          <button type="button" onClick={limpiar} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && filtrados.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtrados.map((c) => (
            <button key={c.id} type="button" onClick={() => seleccionar(c)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
              <span className="text-xs font-medium text-slate-800 flex-1 truncate">{c.nombre}</span>
              {c.nit && <span className="text-[10px] text-slate-400 shrink-0">NIT: {c.nit}</span>}
              {parseFloat(c.descuento_pct) > 0 && (
                <span className="shrink-0 rounded-full bg-green-100 px-1.5 text-[10px] text-green-700 font-semibold">-{c.descuento_pct}%</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página POS ───────────────────────────────────────────────────────────────
export default function NuevaVentaPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const modo: Modo = (params.get("modo") as Modo) ?? "venta";
  const setModo = (m: Modo) => setParams({ modo: m });

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const addDays  = (d: string, n: number) => {
    const dt = new Date(d); dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
  };

  const [empresa,   setEmpresa]   = useState<EmpresaPerfil | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes,  setClientes]  = useState<Cliente[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busqueda,  setBusqueda]  = useState("");

  // Recibo post-procesado
  const [reciboVenta, setReciboVenta] = useState<Venta | null>(null);
  const [reciboCot,   setReciboCot]   = useState<Cotizacion | null>(null);

  // Cliente
  const [clienteNombre,    setClienteNombre]    = useState("");
  const [clienteId,        setClienteId]        = useState<string | null>(null);
  const [clienteTipo,      setClienteTipo]      = useState<string | null>(null);
  const [clienteDescuento, setClienteDescuento] = useState(0); // % editable

  // Carrito
  const [cart, setCart] = useState<CartItem[]>([]);

  // Pago / cotización
  const [metodoPago,  setMetodoPago]  = useState<VentaIn["metodo_pago"]>("efectivo");
  const [montoPagado, setMontoPagado] = useState("");
  const [notas,       setNotas]       = useState("");
  const [fechaVenta,  setFechaVenta]  = useState(todayStr());
  const [fechaCot,    setFechaCot]    = useState(todayStr());
  const [fechaVence,  setFechaVence]  = useState(() => addDays(todayStr(), 7));
  const [saving,      setSaving]      = useState(false);

  // Anchos columnas sticky (igual que inventario)
  const [skuW,  setSkuW]  = useState(130);
  const [univW, setUnivW] = useState(110);
  const [descW, setDescW] = useState(200);
  const resizingRef = useRef<{ startX: number; startW: number } | null>(null);

  const makeResize = (cur: number, set: (w: number) => void) =>
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = { startX: e.clientX, startW: cur };
      const onMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        set(Math.max(60, resizingRef.current.startW + (ev.clientX - resizingRef.current.startX)));
      };
      const onUp = () => {
        resizingRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

  useEffect(() => {
    authApi.empresaPerfil().then(setEmpresa).catch(() => {});
    Promise.all([
      inventarioApi.listProductos({ page_size: 60, only_active: true }).then((r) => setProductos(r.items)),
      inventarioApi.listClientes({ page_size: 200 }).then((r) => setClientes(r.items)),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await inventarioApi.listProductos({
          search: busqueda.trim() || undefined,
          only_active: true,
          page_size: busqueda.trim() ? 150 : 60,
        });
        setProductos(r.items);
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const addToCart = (p: Producto) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, {
        id: p.id, sku: p.sku, nombre: p.nombre,
        precio: parseFloat(p.precio_venta),
        precio_venta:    parseFloat(p.precio_venta),
        precio_mayor:    p.precio_mayor    ? parseFloat(p.precio_mayor)    : null,
        precio_mecanico: p.precio_mecanico ? parseFloat(p.precio_mecanico) : null,
        precio_real:     p.precio_real     ? parseFloat(p.precio_real)     : null,
        cantidad: 1,
        stock: Math.round(Number(p.stock_total ?? 0)),
      }];
    });
  };

  const updateCart = (id: string, field: "cantidad" | "precio", val: number) =>
    setCart((prev) => prev.map((i) =>
      i.id !== id ? i :
      field === "cantidad" ? { ...i, cantidad: Math.max(1, Math.round(val || 1)) }
                           : { ...i, precio: Math.max(0, val) }
    ));

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const cartSubtotal   = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const descuentoMonto = clienteDescuento > 0 ? cartSubtotal * clienteDescuento / 100 : 0;
  const cartTotal      = cartSubtotal - descuentoMonto;

  const procesar = async () => {
    if (cart.length === 0 || saving) return;
    setSaving(true);
    try {
      const items = cart.map((i) => ({
        producto_id: i.id, sku: i.sku, nombre: i.nombre,
        cantidad: i.cantidad, precio_unitario: i.precio,
        costo_unitario: i.precio_venta,
      }));
      if (modo === "venta") {
        const result = await ventasApi.createVenta({
          cliente_id: clienteId || undefined,
          cliente_nombre: clienteNombre || undefined,
          fecha: fechaVenta, metodo_pago: metodoPago,
          descuento_pct: clienteDescuento || undefined,
          monto_pagado: montoPagado ? parseFloat(montoPagado) : undefined,
          notas: notas || undefined, items,
        });
        bust("ventas:"); bust("inv:productos"); // stock cambió
        setReciboVenta(result);
      } else {
        const result = await ventasApi.createCotizacion({
          cliente_id: clienteId || undefined,
          cliente_nombre: clienteNombre || undefined,
          fecha: fechaCot,
          vigencia_dias: Math.max(1, Math.round(
            (new Date(fechaVence).getTime() - new Date(fechaCot).getTime()) / 86400000
          )),
          descuento_monto: descuentoMonto || undefined,
          notas: notas || undefined, items,
        });
        bust("ventas:");
        setReciboCot(result);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "";
      if (msg.toLowerCase().includes("stock insuficiente") || msg.toLowerCase().includes("stock_insuficiente")) {
        toast.error("Stock insuficiente para uno o más productos del carrito");
      } else {
        toast.error("Error al procesar. Intente nuevamente.");
      }
    } finally { setSaving(false); }
  };


  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400 text-sm">Cargando…</div>;
  }

  const W_FOTO = 50;
  const L_SKU  = W_FOTO;
  const L_UNIV = W_FOTO + skuW;
  const L_DESC = W_FOTO + skuW + univW;

  const TH  = "border border-amber-500 bg-amber-400 px-1 py-1 font-bold text-black uppercase text-[10px] text-center leading-tight";
  const TH_S = `${TH} sticky z-40`;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── Barra superior: buscar primero ───────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <button type="button" onClick={() => navigate("/ventas")}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 shrink-0">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="h-5 w-px bg-slate-200 shrink-0" />

        {/* PRIMERO: buscador de productos */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
            placeholder="Buscar repuesto — nombre, SKU, marca, modelo, medida…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Toggle modo */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
          <button type="button" onClick={() => setModo("venta")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors
              ${modo === "venta" ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            <ShoppingCart className="h-3.5 w-3.5" /> Venta
          </button>
          <button type="button" onClick={() => setModo("cotizacion")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors
              ${modo === "cotizacion" ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            <FileText className="h-3.5 w-3.5" /> Cotización
          </button>
        </div>
      </div>

      {/* ── Cuerpo ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Tabla de productos (igual que inventario) ─────────────────── */}
        <div className="flex-1 min-w-0 overflow-auto">
          <table className="border-collapse text-[11px]" style={{ minWidth: "max-content", width: "100%" }}>
            <thead className="sticky top-0 z-30">
              <tr>
                <th className={TH_S} style={{ left: 0, width: W_FOTO, minWidth: W_FOTO }}>FOTO</th>
                <th className={`${TH_S} relative select-none`} style={{ left: L_SKU, width: skuW, minWidth: skuW }}>
                  CÓDIGO
                  <div onMouseDown={makeResize(skuW, setSkuW)} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-amber-600/50" />
                </th>
                <th className={`${TH_S} relative select-none`} style={{ left: L_UNIV, width: univW, minWidth: univW }}>
                  CÓD.{<br />}UNIV.
                  <div onMouseDown={makeResize(univW, setUnivW)} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-amber-600/50" />
                </th>
                <th className={`${TH_S} relative select-none`} style={{ left: L_DESC, width: descW, minWidth: descW }}>
                  DESCRIPCIÓN
                  <div onMouseDown={makeResize(descW, setDescW)} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-amber-600/50" />
                </th>
                {["STOCK","MARCA","PROCEDENCIA","PRECIO FACTURA","PRECIO MAYOR","PRECIO TALLER","PRECIO MAYORISTA","MEDIDA","MODELO"].map((h) => (
                  <th key={h} className={TH}>
                    {h.split(" ").map((w, i) => <React.Fragment key={i}>{i > 0 && <br />}{w}</React.Fragment>)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.length === 0 ? (
                <tr><td colSpan={13} className="py-12 text-center text-sm text-slate-400">
                  {busqueda ? `Sin resultados para "${busqueda}"` : "No hay productos"}
                </td></tr>
              ) : (
                productos.map((p, idx) => {
                  const stock    = Math.round(Number(p.stock_total ?? 0));
                  const stockMin = Math.round(parseFloat(p.stock_minimo));
                  const enCarrito = cart.find((i) => i.id === p.id);
                  const stockColor = stock === 0 ? "text-red-600 font-bold" : stock < stockMin ? "text-orange-500 font-bold" : "text-slate-800";
                  const rowBg = enCarrito ? "#eef2ff" : idx % 2 === 0 ? "#ffffff" : "#fffbeb";
                  const S = "border border-slate-200 px-1 py-1 sticky z-10";
                  const C = "border border-slate-200 px-2 py-1 whitespace-nowrap";
                  return (
                    <tr key={p.id} onClick={() => addToCart(p)}
                      className={`cursor-pointer hover:brightness-95 ${!p.activo ? "opacity-50" : ""}`}
                      style={{ backgroundColor: rowBg }}>
                      <td className={S} style={{ left: 0, width: W_FOTO, minWidth: W_FOTO, maxWidth: W_FOTO, backgroundColor: rowBg }}>
                        <div className="w-7 h-7 rounded overflow-hidden bg-slate-100 flex items-center justify-center">
                          {p.imagen_url ? <img src={p.imagen_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <ImageIcon className="h-3 w-3 text-slate-300" />}
                        </div>
                      </td>
                      <td className={`${S} font-mono text-indigo-700 font-semibold`} style={{ left: L_SKU, width: skuW, minWidth: skuW, maxWidth: skuW, backgroundColor: rowBg }}>{p.sku}</td>
                      <td className={`${S} font-mono text-slate-500`} style={{ left: L_UNIV, width: univW, minWidth: univW, maxWidth: univW, backgroundColor: rowBg }}>{p.codigo_universal ?? "—"}</td>
                      <td className={`${S} text-slate-800 overflow-hidden`} style={{ left: L_DESC, width: descW, minWidth: descW, maxWidth: descW, backgroundColor: rowBg }}>
                        <span className="block truncate">{p.nombre}</span>
                      </td>
                      <td className={`${C} text-center font-mono font-bold ${stockColor}`}>{stock}</td>
                      <td className={`${C} text-slate-600`}>{p.marca ?? "—"}</td>
                      <td className={`${C} text-slate-600`}>{p.procedencia ?? "—"}</td>
                      <td className={`${C} font-mono text-right font-semibold text-emerald-700`}>{fmtBs(p.precio_venta)}</td>
                      <td className={`${C} font-mono text-right text-slate-700`}>{p.precio_mayor ? fmtBs(p.precio_mayor) : "—"}</td>
                      <td className={`${C} font-mono text-right text-slate-700`}>{p.precio_mecanico ? fmtBs(p.precio_mecanico) : "—"}</td>
                      <td className={`${C} font-mono text-right text-blue-700`}>{p.precio_real ? fmtBs(p.precio_real) : "—"}</td>
                      <td className={`${C} text-slate-500`}>{p.medidas ?? "—"}</td>
                      <td className={`${C} text-slate-500`}>{p.modelos ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Panel derecho: carrito + datos ───────────────────────────── */}
        <div className="overflow-y-auto border-l border-slate-300 bg-white" style={{ width: 360 }}>

          {/* ─ Tabla carrito estilo factura ─────────────────────────────── */}
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr>
                <th className="border border-slate-300 px-2 py-1 text-left font-bold text-slate-600 uppercase text-[10px]">Descripción / SKU</th>
                <th className="border border-slate-300 px-1 py-1 text-center font-bold text-slate-600 uppercase text-[10px] w-14">Cant.</th>
                <th className="border border-slate-300 px-1 py-1 text-center font-bold text-slate-600 uppercase text-[10px] w-20">Precio Bs.</th>
                <th className="border border-slate-300 px-1 py-1 text-right font-bold text-slate-600 uppercase text-[10px] w-20">Total</th>
                <th className="border border-slate-300 px-1 py-1 w-7 text-center font-bold text-slate-600 text-[10px]">✕</th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    Haz clic en un producto para agregarlo
                  </td>
                </tr>
              ) : (
                cart.map((item, idx) => {
                  const tipoPrecio =
                    item.precio === item.precio_venta    ? "factura"
                    : item.precio === item.precio_mayor   ? "mayor"
                    : item.precio === item.precio_mecanico ? "taller"
                    : item.precio === item.precio_real    ? "mayorista"
                    : "custom";

                  return (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="border border-slate-200 px-2 py-1">
                        <p className="font-semibold text-slate-800 leading-tight text-xs">{item.nombre}</p>
                        <p className="text-[9px] text-slate-400 font-mono">{item.sku}</p>
                        {/* Selector tipo precio */}
                        <select
                          value={tipoPrecio}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "factura")   updateCart(item.id, "precio", item.precio_venta);
                            else if (v === "mayor"     && item.precio_mayor)    updateCart(item.id, "precio", item.precio_mayor);
                            else if (v === "taller"    && item.precio_mecanico) updateCart(item.id, "precio", item.precio_mecanico);
                            else if (v === "mayorista" && item.precio_real)     updateCart(item.id, "precio", item.precio_real);
                          }}
                          className="mt-0.5 text-[9px] text-slate-500 border border-slate-200 rounded px-0.5 py-0 bg-white cursor-pointer focus:outline-none"
                        >
                          <option value="factura">Precio Factura ({fmtBs(item.precio_venta)})</option>
                          {item.precio_mayor    && <option value="mayor">Precio Mayor ({fmtBs(item.precio_mayor)})</option>}
                          {item.precio_mecanico && <option value="taller">Precio Taller ({fmtBs(item.precio_mecanico)})</option>}
                          {item.precio_real     && <option value="mayorista">Precio Mayorista ({fmtBs(item.precio_real)})</option>}
                          {tipoPrecio === "custom" && <option value="custom">Personalizado</option>}
                        </select>
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        <input type="number" min={1} step={1} value={item.cantidad}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateCart(item.id, "cantidad", parseFloat(e.target.value) || 1)}
                          className="w-11 text-center text-xs font-bold border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        <input type="number" min={0} step={0.01} value={item.precio}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateCart(item.id, "precio", parseFloat(e.target.value) || 0)}
                          className="w-full text-right text-xs font-mono border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-right font-mono font-bold text-slate-800 whitespace-nowrap text-xs">
                        {fmtBs(item.precio * item.cantidad)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        <button type="button" onClick={() => removeFromCart(item.id)}
                          className="flex items-center justify-center w-5 h-5 rounded bg-red-100 hover:bg-red-200 text-red-600 transition-colors mx-auto">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* ─ Datos: cliente, descuento, notas, pago ───────────────────── */}
          <div className="px-3 py-3 space-y-3 border-t border-slate-200">

            {/* Cliente */}
            <div>
              <Label className="text-[10px] font-semibold text-slate-500 tracking-wider">CLIENTE</Label>
              <div className="mt-1">
                <ClienteSearch
                  clientes={clientes}
                  clienteNombre={clienteNombre} setClienteNombre={setClienteNombre}
                  setClienteId={setClienteId}
                  setClienteDescuento={setClienteDescuento}
                  setClienteTipo={setClienteTipo}
                />
              </div>
            </div>

            {/* Descuento — editable siempre */}
            <div className="flex items-center gap-2">
              <Label className="text-[10px] font-semibold text-slate-500 tracking-wider shrink-0">DESCUENTO %</Label>
              <input type="number" min={0} max={100} step={0.5}
                value={clienteDescuento || ""}
                onChange={(e) => setClienteDescuento(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-20 rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              {clienteDescuento > 0 && (
                <span className="text-xs text-green-600 font-semibold">-{fmtBs(descuentoMonto)}</span>
              )}
            </div>

            {/* Totales */}
            <table className="w-full text-xs border-t border-slate-100 pt-1">
              <tbody>
                {clienteDescuento > 0 && (
                  <tr>
                    <td className="text-slate-500 py-0.5">Subtotal</td>
                    <td className="text-right font-mono text-slate-700">{fmtBs(cartSubtotal)}</td>
                  </tr>
                )}
                <tr className="border-t border-slate-200">
                  <td className="font-bold text-slate-800 pt-1 text-sm">TOTAL</td>
                  <td className="text-right font-bold font-mono text-indigo-700 text-sm pt-1">{fmtBs(cartTotal)}</td>
                </tr>
              </tbody>
            </table>

            {/* Notas */}
            <div>
              <Label className="text-[10px] font-semibold text-slate-500 tracking-wider">NOTAS / OBSERVACIONES</Label>
              <textarea rows={2} placeholder="Observaciones…" value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-slate-300" maxLength={500} />
            </div>

            {/* Fechas */}
            {modo === "venta" ? (
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-semibold text-slate-500 shrink-0">FECHA</Label>
                <input type="date" value={fechaVenta} onChange={(e) => setFechaVenta(e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none" />
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-[10px] font-semibold text-slate-500">FECHA</Label>
                  <input type="date" value={fechaCot}
                    onChange={(e) => { setFechaCot(e.target.value); if (fechaVence <= e.target.value) setFechaVence(addDays(e.target.value, 7)); }}
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none" />
                </div>
                <div className="flex-1">
                  <Label className="text-[10px] font-semibold text-slate-500">VÁLIDA HASTA</Label>
                  <input type="date" value={fechaVence} min={fechaCot}
                    onChange={(e) => setFechaVence(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none" />
                </div>
              </div>
            )}

            {/* Método pago */}
            {modo === "venta" && (
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-semibold text-slate-500 shrink-0">PAGO</Label>
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as VentaIn["metodo_pago"])}
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none">
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta_debito">Tarjeta Débito</option>
                  <option value="tarjeta_credito">Tarjeta Crédito</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>
            )}

            {/* Monto recibido */}
            {modo === "venta" && metodoPago === "efectivo" && (
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-semibold text-slate-500 shrink-0">RECIBIDO</Label>
                <Input type="number" placeholder={cartTotal.toFixed(2)} value={montoPagado}
                  onChange={(e) => setMontoPagado(e.target.value)} className="flex-1 text-xs h-7" />
                {montoPagado && parseFloat(montoPagado) >= cartTotal && (
                  <span className="text-xs text-green-600 font-bold shrink-0 whitespace-nowrap">
                    Cambio: {fmtBs(parseFloat(montoPagado) - cartTotal)}
                  </span>
                )}
              </div>
            )}

            {/* Botón */}
            <Button onClick={procesar} disabled={cart.length === 0 || saving}
              className={`w-full font-bold text-white text-sm ${modo === "venta" ? "bg-slate-800 hover:bg-slate-900" : "bg-indigo-600 hover:bg-indigo-700"}`}>
              {saving ? "Procesando…" : modo === "venta" ? "✓ Procesar Venta" : "✓ Guardar Cotización"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Modal recibo de venta ──────────────────────────────────────── */}
      <Dialog open={!!reciboVenta} onOpenChange={() => navigate("/ventas")}>
        <DialogContent className="max-w-sm overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Printer className="h-4 w-4" /> Recibo de Venta
              </DialogTitle>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            </div>
          </DialogHeader>
          {reciboVenta && <ReciboVenta venta={reciboVenta} empresa={empresa} />}
        </DialogContent>
      </Dialog>

      {/* ── Modal recibo de cotización ─────────────────────────────────── */}
      <Dialog open={!!reciboCot} onOpenChange={() => navigate("/ventas")}>
        <DialogContent className="max-w-sm overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Cotización
              </DialogTitle>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            </div>
          </DialogHeader>
          {reciboCot && <DocCotizacion cot={reciboCot} empresa={empresa} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
