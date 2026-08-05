import {
  ArrowLeftRight, Check, ChevronDown, Clock, Eye, FileText, MessageCircle,
  Minus, Plus, Printer, Search, ShoppingCart, TrendingUp, X, XCircle,
} from "lucide-react";
import { useMemo } from "react";
import DevolucionesTab from "@/modules/ventas/pages/DevolucionesTab";
import { useEffect, useRef, useState } from "react";
import { swr, bust, peek } from "@/shared/utils/cache";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { authApi } from "@/modules/auth/services/authApi";
import { inventarioApi } from "@/modules/inventario/services/inventarioApi";
import { ventasApi, type TopProducto } from "@/modules/ventas/services/ventasApi";
import type { Cliente, Cotizacion, EmpresaPerfil, Producto, Venta } from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────
type Tab = "ventas" | "cotizaciones" | "devoluciones";
interface CartItem {
  id: string; sku: string; nombre: string;
  precio: number; cantidad: number; stock: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de badges
// ─────────────────────────────────────────────────────────────────────────────
function TipoBadge({ tipo }: { tipo?: string | null }) {
  if (!tipo) return null;
  const cfg: Record<string, string> = {
    mecanico: "bg-blue-100 text-blue-700",
    mayorista: "bg-green-100 text-green-700",
    particular: "bg-slate-100 text-slate-600",
  };
  const lbl: Record<string, string> = {
    mecanico: "Mecánico", mayorista: "Mayorista", particular: "Particular",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg[tipo] ?? "bg-slate-100 text-slate-500"}`}>
      {lbl[tipo] ?? tipo}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg: Record<string, string> = {
    aprobada: "bg-green-100 text-green-700",
    pendiente: "bg-yellow-100 text-yellow-700",
    rechazada: "bg-red-100 text-red-600",
    vencida: "bg-slate-100 text-slate-500",
    convertida: "bg-blue-100 text-blue-700",
    completada: "bg-green-100 text-green-700",
    anulada: "bg-red-100 text-red-600",
    borrador: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cfg[estado] ?? "bg-slate-100 text-slate-500"}`}>
      {estado}
    </span>
  );
}

const METODOS: Record<string, string> = {
  efectivo: "Efectivo", tarjeta_debito: "Tarjeta de Débito",
  tarjeta_credito: "Tarjeta de Crédito", transferencia: "Transferencia", mixto: "Mixto",
};

// ─────────────────────────────────────────────────────────────────────────────
// Cabecera de empresa para documentos impresos
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Recibo de Venta — documento para imprimir / ver
// ─────────────────────────────────────────────────────────────────────────────
function ReciboVenta({ venta, empresa }: { venta: Venta; empresa: EmpresaPerfil | null }) {
  const descuento = parseFloat(venta.descuento_monto ?? "0");
  return (
    <div className="font-mono text-xs space-y-1 max-w-[320px] mx-auto" id="print-doc">
      <EmpresaHeader empresa={empresa} />
      <div className="border-t border-dashed border-slate-300 my-3" />
      <p className="text-center font-bold text-sm tracking-widest">RECIBO DE VENTA</p>
      <p className="text-center text-slate-700">No. {venta.numero}</p>
      <p className="text-center text-slate-500">
        {venta.fecha} {venta.created_at?.slice(11, 16)}
      </p>
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
          <span>{METODOS[venta.metodo_pago] ?? venta.metodo_pago}</span>
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
          <p className="text-slate-400">
            {it.cantidad} × {fmtBs(it.precio_unitario)}
          </p>
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

// ─────────────────────────────────────────────────────────────────────────────
// Documento Cotización — para imprimir / WhatsApp
// ─────────────────────────────────────────────────────────────────────────────
function DocCotizacion({ cot, empresa }: { cot: Cotizacion; empresa: EmpresaPerfil | null }) {
  const descuento = parseFloat(cot.descuento_monto ?? "0");
  const subtotal = parseFloat(cot.subtotal ?? "0");
  const descPct = subtotal > 0 ? Math.round((descuento / subtotal) * 100) : 0;
  const venceProximo = cot.fecha_vence
    ? new Date(cot.fecha_vence) <= new Date(Date.now() + 3 * 86400000)
    : false;

  return (
    <div className="font-sans text-sm space-y-1 max-w-[360px] mx-auto" id="print-doc">
      <EmpresaHeader empresa={empresa} />
      <div className="border-t border-dashed border-slate-300 my-3" />
      <p className="text-center font-bold text-sm tracking-widest">COTIZACIÓN</p>
      <p className="text-center text-slate-700">No. {cot.numero}</p>
      <p className="text-center text-slate-500">
        {cot.fecha} {cot.created_at?.slice(11, 16)}
      </p>
      <div className="flex justify-center mt-1">
        <EstadoBadge estado={cot.estado} />
      </div>
      <div className="border-t border-dashed border-slate-300 my-3" />
      <div className="space-y-1 text-xs">
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
          <span className={venceProximo ? "text-orange-500 font-semibold" : ""}>
            {cot.fecha_vence ?? `+${cot.vigencia_dias} días`}
          </span>
        </div>
      </div>
      <div className="border-t border-dashed border-slate-300 my-3" />
      <div className="flex justify-between text-[10px] font-semibold text-slate-500 pb-1">
        <span>DESCRIPCIÓN</span><span>TOTAL</span>
      </div>
      {cot.items.map((it) => (
        <div key={it.id} className="mb-2">
          <div className="flex justify-between text-xs">
            <span className="font-semibold">{it.nombre}</span>
            <span className="font-semibold">{fmtBs(it.subtotal)}</span>
          </div>
          <p className="text-[10px] text-slate-400">SKU: {it.sku}</p>
          <p className="text-[10px] text-slate-500">
            {it.cantidad} × {fmtBs(it.precio_unitario)}
          </p>
        </div>
      ))}
      <div className="border-t border-dashed border-slate-300 my-3" />
      <div className="flex justify-between text-xs text-slate-600">
        <span>Subtotal:</span><span>{fmtBs(cot.subtotal)}</span>
      </div>
      {descuento > 0 && (
        <div className="flex justify-between text-xs text-green-600 font-medium">
          <span>Descuento ({descPct}%):</span>
          <span>-{fmtBs(cot.descuento_monto)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL:</span><span>{fmtBs(cot.total)}</span>
      </div>
      {cot.notas && (
        <>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <p className="text-xs font-semibold text-slate-600">DETALLE / NOTAS</p>
          <p className="text-xs text-slate-500">{cot.notas}</p>
        </>
      )}
      <div className="border-t border-dashed border-slate-300 mt-3 pt-2">
        <p className="text-center text-[10px] text-slate-400">
          Esta cotización no genera compromiso de compra.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ClienteSearch — campo con autocomplete
// ─────────────────────────────────────────────────────────────────────────────
interface ClienteSearchProps {
  clientes: Cliente[];
  clienteNombre: string;
  setClienteNombre: (v: string) => void;
  clienteId: string | null;
  setClienteId: (v: string | null) => void;
  clienteDescuento: number;
  setClienteDescuento: (v: number) => void;
  setClienteTipo: (v: string | null) => void;
}
function ClienteSearch({
  clientes, clienteNombre, setClienteNombre, clienteId,
  setClienteId, clienteDescuento, setClienteDescuento, setClienteTipo,
}: ClienteSearchProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtrados = clienteNombre.trim().length >= 1
    ? clientes.filter((c) =>
        c.nombre.toLowerCase().includes(clienteNombre.toLowerCase()) ||
        (c.nit ?? "").toLowerCase().includes(clienteNombre.toLowerCase())
      ).slice(0, 6)
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
    setClienteNombre(""); setClienteId(null);
    setClienteTipo(null); setClienteDescuento(0); setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Label className="text-xs font-semibold text-slate-600">CLIENTE</Label>
      <div className="relative mt-1 flex items-center">
        <Input
          className="pr-8"
          placeholder="Buscar por nombre, NIT… (opcional)"
          value={clienteNombre}
          onChange={(e) => {
            setClienteNombre(e.target.value);
            setClienteId(null); setClienteTipo(null); setClienteDescuento(0);
            setOpen(true);
          }}
          onFocus={() => { if (clienteNombre.trim()) setOpen(true); }}
        />
        {clienteNombre ? (
          <button type="button" onClick={limpiar} className="absolute right-2 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
        )}
      </div>

      {/* Banner de descuento cuando hay cliente con descuento */}
      {clienteId && clienteDescuento > 0 && (
        <div className="mt-1 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5">
          <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
          <p className="text-[11px] text-green-700 font-medium">
            {clienteNombre} · Precio Por Mayor ({clienteDescuento}% desc.)
          </p>
          <ChevronDown className="h-3 w-3 text-green-500 ml-auto" />
        </div>
      )}
      {clienteId && clienteDescuento === 0 && (
        <p className="mt-0.5 text-[10px] text-green-600 font-medium">✓ Cliente registrado vinculado</p>
      )}

      {open && filtrados.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtrados.map((c) => (
            <button
              key={c.id} type="button"
              onClick={() => seleccionar(c)}
              className="flex w-full items-center justify-between px-3 py-2 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-slate-700">{c.nombre}</p>
                <p className="text-[10px] text-slate-400">
                  {c.nit ? `NIT: ${c.nit}` : ""}
                  {c.nit && parseFloat(c.descuento_pct) > 0 ? " · " : ""}
                  {parseFloat(c.descuento_pct) > 0 ? `${c.descuento_pct}% dto.` : ""}
                </p>
              </div>
              <TipoBadge tipo={c.tipo} />
            </button>
          ))}
        </div>
      )}
      {open && clienteNombre.trim().length >= 1 && filtrados.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg px-3 py-2">
          <p className="text-xs text-slate-400">Sin resultados · se guardará como cliente libre</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function VentasPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("ventas");
  const [ventas, setVentas]             = useState<Venta[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [productos, setProductos]       = useState<Producto[]>([]);
  const [clientes, setClientes]         = useState<Cliente[]>([]);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);
  const [empresa, setEmpresa]           = useState<EmpresaPerfil | null>(null);
  const [loading, setLoading]           = useState(true);

  // Modales
  const [modalCot, setModalCot]           = useState(false);
  const [modalRecibo, setModalRecibo]     = useState<Venta | null>(null);
  const [modalVerCot, setModalVerCot]     = useState<Cotizacion | null>(null);

  // Buscadores de tabla
  const [busqVentas, setBusqVentas] = useState("");
  const [busqDevs, setBusqDevs]     = useState("");

  // Formulario compartido venta/cotización
  const [busqueda, setBusqueda]             = useState("");
  const [clienteNombre, setClienteNombre]   = useState("");
  const [clienteId, setClienteId]           = useState<string | null>(null);
  const [clienteTipo, setClienteTipo]       = useState<string | null>(null);
  const [clienteDescuento, setClienteDescuento] = useState(0);
  const [notas, setNotas]                   = useState("");
  const [cart, setCart]                     = useState<CartItem[]>([]);
  const [saving, setSaving]                 = useState(false);

  // Fechas de venta y cotización
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const addDays  = (d: string, n: number) => {
    const dt = new Date(d); dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  const [fechaCot,   setFechaCot]   = useState(todayStr);
  const [fechaVence, setFechaVence] = useState(() => addDays(todayStr(), 7));

  // Filtros cotizaciones
  const [searchCot, setSearchCot]   = useState("");
  const [estadoCot, setEstadoCot]   = useState("");

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const cargarVentas = async () => {
    bust("ventas:lista");
    try { setVentas((await ventasApi.listVentas({ page_size: 100 })).items); }
    catch (e) { console.error(e); }
  };
  const cargarCotizaciones = async () => {
    bust("ventas:cots");
    try { setCotizaciones((await ventasApi.listCotizaciones({ page_size: 100 })).items); }
    catch (e) { console.error(e); }
  };

  useEffect(() => {
    const alive = { v: true };
    const shown = new Set<string>();
    const KEYS = ["v", "c", "tp", "p", "cl", "emp"];
    const mark = (k: string) => {
      shown.add(k);
      if (KEYS.every(x => shown.has(x)) && alive.v) setLoading(false);
    };

    swr("ventas:lista",
      () => ventasApi.listVentas({ page_size: 100 }),
      (r) => { if (alive.v) setVentas(r.items); mark("v"); },
      30_000,
    );
    swr("ventas:cots",
      () => ventasApi.listCotizaciones({ page_size: 100 }),
      (r) => { if (alive.v) setCotizaciones(r.items); mark("c"); },
      30_000,
    );
    swr("ventas:top",
      () => ventasApi.topProductos(30, 5),
      (r) => { if (alive.v) setTopProductos(r); mark("tp"); },
      60_000,
    );
    swr("inv:productos:ventas",
      () => inventarioApi.listProductos({ page_size: 60, only_active: true }),
      (r) => { if (alive.v) setProductos(r.items); mark("p"); },
      300_000,
    );
    swr("inv:clientes",
      () => inventarioApi.listClientes({ page_size: 200 }),
      (r) => { if (alive.v) setClientes(r.items); mark("cl"); },
      300_000,
    );
    swr("auth:empresa",
      () => authApi.empresaPerfil(),
      (r) => { if (alive.v) setEmpresa(r); mark("emp"); },
      600_000,
    );

    return () => { alive.v = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalVentas   = ventas.reduce((s, v) => s + parseFloat(v.total), 0);
  const hoy           = new Date().toISOString().slice(0, 10);
  const ventasHoy     = ventas.filter((v) => v.fecha === hoy).reduce((s, v) => s + parseFloat(v.total), 0);
  const cotPendientes = cotizaciones.filter((c) => c.estado === "pendiente").length;
  const ticketProm    = ventas.length ? totalVentas / ventas.length : 0;

  // ── Ventas filtradas para tabla ───────────────────────────────────────────
  const ventasFiltradas = busqVentas.trim()
    ? ventas.filter(v => {
        const q = busqVentas.toLowerCase();
        return v.numero.toLowerCase().includes(q) ||
          (v.cliente_nombre ?? "").toLowerCase().includes(q) ||
          (v.vendedor_nombre ?? "").toLowerCase().includes(q) ||
          v.fecha.includes(q) ||
          v.metodo_pago.replace(/_/g, " ").includes(q) ||
          v.total.includes(q) ||
          v.estado.toLowerCase().includes(q);
      })
    : ventas;

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const r = await inventarioApi.listProductos({
          search: busqueda.trim() || undefined,
          only_active: true,
          page_size: busqueda.trim() ? 100 : 60,
        });
        setProductos(r.items);
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // ── Productos filtrados (siempre visibles) ─────────────────────────────────
  const repFiltrados = busqueda.trim() ? productos : productos.slice(0, 60);

  // ── Acciones de carrito ────────────────────────────────────────────────────
  const addToCart = (p: Producto) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, {
        id: p.id, sku: p.sku, nombre: p.nombre,
        precio: parseFloat(p.precio_venta),
        cantidad: 1,
        stock: Math.round(Number(p.stock_total ?? 0)),
      }];
    });
  };
  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  // ── Totales con descuento ──────────────────────────────────────────────────
  const cartSubtotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const descuentoMonto = clienteDescuento > 0 ? cartSubtotal * clienteDescuento / 100 : 0;
  const cartTotal = cartSubtotal - descuentoMonto;

  const resetForm = () => {
    const hoy = todayStr();
    setCart([]); setBusqueda(""); setClienteNombre(""); setClienteId(null);
    setClienteTipo(null); setClienteDescuento(0); setNotas("");
    setFechaCot(hoy);
    setFechaVence(addDays(hoy, 7));
  };

  // ── Crear cotización ───────────────────────────────────────────────────────
  const handleGuardarCot = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      // Calcular vigencia_dias a partir de las dos fechas elegidas
      const dias = Math.max(1, Math.round(
        (new Date(fechaVence).getTime() - new Date(fechaCot).getTime()) / 86_400_000
      ));
      const cot = await ventasApi.createCotizacion({
        cliente_id: clienteId ?? undefined,
        cliente_nombre: clienteNombre || undefined,
        fecha: fechaCot,
        vigencia_dias: dias,
        descuento_monto: descuentoMonto > 0 ? descuentoMonto : undefined,
        notas: notas || undefined,
        items: cart.map((i) => ({
          producto_id: i.id, sku: i.sku, nombre: i.nombre,
          cantidad: i.cantidad, precio_unitario: i.precio,
        })),
      });
      await cargarCotizaciones();
      setModalCot(false);
      resetForm();
      setModalVerCot(cot); // Ver la cotización recién creada
    } catch (err) { console.error(err); alert("Error al guardar cotización."); }
    finally { setSaving(false); }
  };

  // ── Cambiar estado cotización ──────────────────────────────────────────────
  const cambiarEstado = async (id: string, estado: "pendiente" | "aprobada" | "rechazada") => {
    try {
      await ventasApi.cambiarEstadoCotizacion(id, estado);
      await cargarCotizaciones();
    } catch (err) { console.error(err); }
  };

  // ── Ver venta completa (fetch on demand) ─────────────────────────────────
  const verVenta = async (v: Venta) => {
    try {
      const full = await ventasApi.getVenta(v.id);
      setModalRecibo(full);
    } catch { setModalRecibo(v); } // fallback: mostrar aunque sin ítems
  };

  // ── Ver cotización completa (fetch on demand) ─────────────────────────────
  const verCotizacion = async (c: Cotizacion) => {
    try {
      const full = await ventasApi.getCotizacion(c.id);
      setModalVerCot(full);
    } catch { setModalVerCot(c); }
  };

  // ── WhatsApp cotización ────────────────────────────────────────────────────
  const compartirWhatsApp = (cot: Cotizacion) => {
    const desc = parseFloat(cot.descuento_monto ?? "0");
    const empNombre = empresa?.nombre_comercial ?? empresa?.razon_social ?? "Autorepuestos";
    let texto = `*${empNombre.toUpperCase()}*\n`;
    if (empresa?.telefono) texto += `Tel: ${empresa.telefono}\n`;
    texto += `\n*COTIZACIÓN ${cot.numero}*\n`;
    texto += `Fecha: ${cot.fecha}\n`;
    texto += `Válida hasta: ${cot.fecha_vence ?? `+${cot.vigencia_dias} días`}\n\n`;
    texto += `*DETALLE:*\n`;
    cot.items.forEach((i) => {
      texto += `• ${i.nombre}\n  ${i.cantidad}u × ${fmtBs(i.precio_unitario)} = *${fmtBs(i.subtotal)}*\n`;
    });
    if (desc > 0) {
      texto += `\nSubtotal: ${fmtBs(cot.subtotal)}\nDescuento: -${fmtBs(cot.descuento_monto)}\n`;
    }
    texto += `\n*TOTAL: ${fmtBs(cot.total)}*\n`;
    if (cot.notas) texto += `\n_${cot.notas}_\n`;
    texto += `\n_Esta cotización no genera compromiso de compra._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  // ── Imprimir ───────────────────────────────────────────────────────────────
  const imprimir = () => window.print();

  // ── Cotizaciones filtradas ────────────────────────────────────────────────
  const cotsFiltradas = cotizaciones.filter((c) => {
    const matchE = !estadoCot || c.estado === estadoCot;
    const q = searchCot.toLowerCase();
    return matchE && (!q || (c.numero ?? "").toLowerCase().includes(q) || (c.cliente_nombre ?? "").toLowerCase().includes(q));
  });

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400 text-sm">Cargando…</div>;
  }

  return (
    <div className="space-y-5">
      {/* ── Estilos de impresión ──────────────────────────────────────────── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-doc, #print-doc * { display: block !important; visibility: visible !important; }
          #print-doc { position: fixed; top: 0; left: 0; width: 100%; font-size: 11px; }
        }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Ventas de Autorepuestos</h1>
          <p className="text-sm text-slate-500">Registro de ventas y cotizaciones del día</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/ventas/nueva?modo=cotizacion")} variant="outline" className="gap-1.5 text-sm">
            <FileText className="h-4 w-4" /> Nueva Cotización
          </Button>
          <Button onClick={() => navigate("/ventas/nueva")} className="gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm">
            <Plus className="h-4 w-4" /> Nueva Venta
          </Button>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ingresos Totales",        value: fmtBs(totalVentas),    color: "text-green-600" },
          { label: "Ventas Hoy",              value: fmtBs(ventasHoy),      color: "text-blue-600"  },
          { label: "Cotizaciones Pendientes", value: String(cotPendientes), color: "text-yellow-600" },
          { label: "Ticket Promedio",         value: fmtBs(ticketProm),     color: "text-slate-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">
        {/* Tabla principal */}
        <div className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200 px-5">
            <button type="button" onClick={() => setTab("ventas")}
              className={`-mb-px mr-4 border-b-2 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === "ventas" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
              <ShoppingCart className="h-4 w-4" /> Ventas ({ventas.length})
            </button>
            <button type="button" onClick={() => setTab("cotizaciones")}
              className={`-mb-px mr-4 border-b-2 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === "cotizaciones" ? "border-slate-800 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
              <FileText className="h-4 w-4" /> Cotizaciones ({cotizaciones.length})
            </button>
            <button type="button" onClick={() => setTab("devoluciones")}
              className={`-mb-px mr-4 border-b-2 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === "devoluciones" ? "border-rose-600 text-rose-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
              <ArrowLeftRight className="h-4 w-4" /> Devoluciones
            </button>
          </div>

          {/* Tab Ventas */}
          {tab === "ventas" && (
            <div className="overflow-x-auto">
              {ventas.length === 0 ? (
                <EmptyTab icon={<ShoppingCart className="h-10 w-10 mb-3" />} label="Aún no hay ventas" action={<Button onClick={() => navigate("/ventas/nueva")} className="mt-4 bg-slate-800 text-white text-sm"><Plus className="h-4 w-4 mr-1" />Primera venta</Button>} />
              ) : (
                <>
                  <div className="border-b border-slate-100 px-4 py-2">
                    <div className="relative max-w-sm">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:bg-white"
                        placeholder="Buscar por número, cliente, vendedor, fecha…"
                        value={busqVentas}
                        onChange={e => setBusqVentas(e.target.value)}
                      />
                    </div>
                  </div>
                  <table className="w-full text-sm border-collapse [&_td]:border [&_td]:border-slate-200">
                  <thead>
                    <tr>
                      {["ID / FECHA", "CLIENTE", "VENDEDOR", "TOTAL", "MÉTODO DE PAGO", "ESTADO", "ACCIONES"].map((h) => (
                        <th key={h} className="border border-amber-500 bg-amber-400 px-3 py-2 text-left font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ventasFiltradas.map((v, idx) => (
                      <tr key={v.id} className={idx % 2 === 0 ? "bg-white hover:bg-amber-100/60" : "bg-amber-50/40 hover:bg-amber-100/60"}>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-semibold text-slate-700">{v.numero}</p>
                          <p className="text-[10px] text-slate-400">{v.fecha} {v.created_at?.slice(11, 16)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-700">{v.cliente_nombre ?? "Cliente general"}</p>
                          <TipoBadge tipo={v.cliente_tipo} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{v.vendedor_nombre ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{fmtBs(v.total)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{METODOS[v.metodo_pago] ?? v.metodo_pago}</td>
                        <td className="px-4 py-3"><EstadoBadge estado={v.estado} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => verVenta(v)} className="rounded p-1 text-blue-500 hover:bg-blue-50" title="Ver recibo">
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => verVenta(v)} className="rounded p-1 text-slate-400 hover:bg-slate-50" title="Detalles">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}
            </div>
          )}

          {/* Tab Cotizaciones */}
          {tab === "cotizaciones" && (
            <div className="p-4">
              <div className="grid gap-3 sm:grid-cols-3 mb-4">
                {[
                  { label: "Pendientes",      value: cotizaciones.filter((c) => c.estado === "pendiente").length, color: "text-yellow-600" },
                  { label: "Aprobadas",       value: cotizaciones.filter((c) => c.estado === "aprobada").length,  color: "text-green-600" },
                  { label: "Valor Pendiente", value: fmtBs(cotizaciones.filter((c) => c.estado === "pendiente").reduce((s, c) => s + parseFloat(c.total), 0)), color: "text-slate-800" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 placeholder:text-slate-400" placeholder="Buscar cotización o cliente…" value={searchCot} onChange={(e) => setSearchCot(e.target.value)} />
                </div>
                <select className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none" value={estadoCot} onChange={(e) => setEstadoCot(e.target.value)}>
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="rechazada">Rechazada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </div>

              {cotsFiltradas.length === 0 ? (
                <EmptyTab icon={<FileText className="h-10 w-10 mb-3" />} label="No hay cotizaciones" action={<Button onClick={() => navigate("/ventas/nueva?modo=cotizacion")} className="mt-4 bg-slate-700 text-white text-sm"><Plus className="h-4 w-4 mr-1" />Nueva cotización</Button>} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse [&_td]:border [&_td]:border-slate-200">
                    <thead>
                      <tr>
                        {["ID / FECHA", "CLIENTE", "VENDEDOR", "TOTAL", "ESTADO", "VÁLIDA HASTA", "ACCIONES"].map((h) => (
                          <th key={h} className="border border-amber-500 bg-amber-400 px-3 py-2 text-left font-bold text-black whitespace-nowrap uppercase tracking-wide text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cotsFiltradas.map((c, idx) => (
                        <tr key={c.id} className={idx % 2 === 0 ? "bg-white hover:bg-amber-100/60" : "bg-amber-50/40 hover:bg-amber-100/60"}>
                          <td className="px-3 py-3">
                            <p className="font-mono text-xs font-semibold text-slate-700">{c.numero}</p>
                            <p className="text-[10px] text-slate-400">{c.fecha}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-sm text-slate-700">{c.cliente_nombre ?? "—"}</p>
                            <TipoBadge tipo={c.cliente_tipo} />
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{c.vendedor_nombre ?? "—"}</td>
                          <td className="px-3 py-3 font-semibold text-slate-800">{fmtBs(c.total)}</td>
                          <td className="px-3 py-3"><EstadoBadge estado={c.estado} /></td>
                          <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{c.fecha_vence ?? `+${c.vigencia_dias}d`}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-0.5">
                              {c.estado === "pendiente" && (
                                <button type="button" onClick={() => navigate(`/ventas/nueva?cotizacion_id=${c.id}`)} className="rounded p-1 text-green-500 hover:bg-green-50" title="Convertir a venta"><ShoppingCart className="h-3.5 w-3.5" /></button>
                              )}
                              {c.estado !== "aprobada" && c.estado !== "rechazada" && (
                                <button type="button" onClick={() => cambiarEstado(c.id, "aprobada")} className="rounded p-1 text-emerald-500 hover:bg-emerald-50" title="Aprobar"><Check className="h-3.5 w-3.5" /></button>
                              )}
                              {c.estado !== "rechazada" && (
                                <button type="button" onClick={() => cambiarEstado(c.id, "rechazada")} className="rounded p-1 text-red-400 hover:bg-red-50" title="Rechazar"><XCircle className="h-3.5 w-3.5" /></button>
                              )}
                              {c.estado !== "pendiente" && (
                                <button type="button" onClick={() => cambiarEstado(c.id, "pendiente")} className="rounded p-1 text-yellow-500 hover:bg-yellow-50" title="Pendiente"><Clock className="h-3.5 w-3.5" /></button>
                              )}
                              <button type="button" onClick={() => verCotizacion(c)} className="rounded p-1 text-blue-500 hover:bg-blue-50" title="Ver cotización"><Eye className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab Devoluciones */}
          {tab === "devoluciones" && (
            <div className="h-[calc(100vh-280px)]">
              <DevolucionesTab />
            </div>
          )}
        </div>

        {/* Top Productos */}
        <div className="w-64 shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">Repuestos Más Vendidos</span>
          </div>
          <div className="p-3 space-y-2">
            {topProductos.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Sin datos de ventas aún</p>
            ) : (
              topProductos.map((p, i) => (
                <div key={p.sku} className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? "bg-indigo-500" : i === 1 ? "bg-indigo-400" : i === 2 ? "bg-indigo-300" : "bg-slate-300"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-tight line-clamp-2">{p.nombre}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{Math.round(Number(p.cantidad_vendida))} uds · {p.sku}</p>
                    <p className="text-xs font-semibold text-slate-800">{fmtBs(p.total_vendido)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          Modal Nueva Cotización
          ───────────────────────────────────────────────────────────────────── */}
      <Dialog open={modalCot} onOpenChange={(o) => { if (!o) { setModalCot(false); resetForm(); } }}>
        <DialogContent className="w-[95vw] max-w-[1180px] max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Nueva Cotización
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-6 py-4 flex flex-col">
            <ProductSearchPanel
              busqueda={busqueda} setBusqueda={setBusqueda}
              repFiltrados={repFiltrados} addToCart={addToCart}
              cart={cart} setCart={setCart} removeFromCart={removeFromCart}
              cartSubtotal={cartSubtotal} descuentoMonto={descuentoMonto}
              clienteDescuento={clienteDescuento} cartTotal={cartTotal}
              notas={notas} setNotas={setNotas}
              clientes={clientes}
              clienteNombre={clienteNombre} setClienteNombre={setClienteNombre}
              clienteId={clienteId} setClienteId={setClienteId}
              clienteDescuentoVal={clienteDescuento} setClienteDescuento={setClienteDescuento}
              setClienteTipo={setClienteTipo}
              footer={
                <div className="space-y-2.5">
                  {/* Fecha de la cotización */}
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">FECHA COTIZACIÓN</Label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                      value={fechaCot}
                      onChange={(e) => {
                        setFechaCot(e.target.value);
                        // Si la fecha de vencimiento quedó antes de la nueva fecha, ajustar
                        if (fechaVence <= e.target.value)
                          setFechaVence(addDays(e.target.value, 7));
                      }}
                    />
                  </div>
                  {/* Fecha de vencimiento */}
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">VÁLIDA HASTA</Label>
                    <input
                      type="date"
                      min={addDays(fechaCot, 1)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
                      value={fechaVence}
                      onChange={(e) => setFechaVence(e.target.value)}
                    />
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Vigencia: {Math.max(1, Math.round((new Date(fechaVence).getTime() - new Date(fechaCot).getTime()) / 86_400_000))} días
                    </p>
                  </div>
                  {/* Detalle / condiciones */}
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">DETALLE / CONDICIONES</Label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-slate-300"
                      rows={2} placeholder="Condiciones de pago, observaciones…"
                      value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500}
                    />
                    <p className="text-right text-[10px] text-slate-400">{notas.length}/500</p>
                  </div>
                  <Button onClick={handleGuardarCot} disabled={cart.length === 0 || saving} className="w-full bg-slate-700 hover:bg-slate-800 text-white">
                    {saving ? "Guardando…" : "💾 Guardar Cotización"}
                  </Button>
                </div>
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────
          Modal Recibo de Venta
          ───────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!modalRecibo} onOpenChange={() => setModalRecibo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Printer className="h-4 w-4" /> Recibo de Venta
              </DialogTitle>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={imprimir}>
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            </div>
          </DialogHeader>
          {modalRecibo && <ReciboVenta venta={modalRecibo} empresa={empresa} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRecibo(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────
          Modal Ver Cotización
          ───────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!modalVerCot} onOpenChange={() => setModalVerCot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Cotización
              </DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={imprimir}>
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </Button>
                {modalVerCot && (
                  <Button size="sm" className="gap-1 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => compartirWhatsApp(modalVerCot)}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          {modalVerCot && <DocCotizacion cot={modalVerCot} empresa={empresa} />}
          <DialogFooter className="gap-2">
            {modalVerCot && modalVerCot.estado !== "aprobada" && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1" onClick={() => { cambiarEstado(modalVerCot.id, "aprobada"); setModalVerCot(null); }}>
                <Check className="h-3.5 w-3.5" /> Aprobar
              </Button>
            )}
            {modalVerCot && modalVerCot.estado !== "rechazada" && (
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1" onClick={() => { cambiarEstado(modalVerCot.id, "rechazada"); setModalVerCot(null); }}>
                <XCircle className="h-3.5 w-3.5" /> Rechazar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setModalVerCot(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state helper
// ─────────────────────────────────────────────────────────────────────────────
function EmptyTab({ icon, label, action }: { icon: React.ReactNode; label: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-300">
      {icon}
      <p className="text-sm">{label}</p>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductSearchPanel — búsqueda de productos + carrito (reutilizable)
// ─────────────────────────────────────────────────────────────────────────────
interface ProductSearchPanelProps {
  busqueda: string; setBusqueda: (v: string) => void;
  repFiltrados: Producto[]; addToCart: (p: Producto) => void;
  cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  removeFromCart: (id: string) => void;
  cartSubtotal: number; descuentoMonto: number;
  clienteDescuento: number; cartTotal: number;
  notas: string; setNotas: (v: string) => void;
  clientes: Cliente[];
  clienteNombre: string; setClienteNombre: (v: string) => void;
  clienteId: string | null; setClienteId: (v: string | null) => void;
  clienteDescuentoVal: number; setClienteDescuento: (v: number) => void;
  setClienteTipo: (v: string | null) => void;
  footer: React.ReactNode;
}

function ProductSearchPanel({
  busqueda, setBusqueda, repFiltrados, addToCart,
  cart, setCart, removeFromCart,
  cartSubtotal, descuentoMonto, clienteDescuento, cartTotal,
  notas, setNotas,
  clientes, clienteNombre, setClienteNombre,
  clienteId, setClienteId, clienteDescuentoVal, setClienteDescuento, setClienteTipo,
  footer,
}: ProductSearchPanelProps) {
  return (
    /* min-h-0 es clave: permite que los hijos flex se compriman y habilita
       overflow-y-auto en los paneles internos sin desbordarse del modal */
    <div className="flex gap-6 flex-1 min-h-0">

      {/* ── Panel izquierdo — cliente + catálogo ──────────────────────────── */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
        {/* Búsqueda de cliente */}
        <div className="shrink-0">
          <ClienteSearch
            clientes={clientes}
            clienteNombre={clienteNombre} setClienteNombre={setClienteNombre}
            clienteId={clienteId} setClienteId={setClienteId}
            clienteDescuento={clienteDescuentoVal} setClienteDescuento={setClienteDescuento}
            setClienteTipo={setClienteTipo}
          />
        </div>

        {/* Buscador + lista de productos */}
        <div className="flex flex-col flex-1 min-h-0">
          <Label className="shrink-0 text-xs font-semibold text-slate-500 tracking-wider">BUSCAR REPUESTO</Label>
          <div className="relative shrink-0 mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
              placeholder="Nombre, SKU, marca, modelo o medida…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Catálogo — flex-1 + min-h-0 + overflow-y-auto = scroll propio */}
          <div className="mt-2 flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
            {repFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                <Search className="h-8 w-8 mb-2" />
                <p className="text-sm">
                  {busqueda ? `Sin resultados para "${busqueda}"` : "No hay productos cargados"}
                </p>
              </div>
            ) : (
              repFiltrados.map((r) => {
                const stock = Math.round(Number(r.stock_total ?? 0));
                const enCarrito = cart.find((i) => i.id === r.id);
                const stockColor = stock === 0 ? "text-red-500" : stock < 5 ? "text-orange-500" : "text-emerald-600";
                return (
                  <button
                    key={r.id} type="button" onClick={() => addToCart(r)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors
                      ${enCarrito ? "bg-indigo-50/60 hover:bg-indigo-50" : "hover:bg-slate-50"}`}
                  >
                    {r.imagen_url ? (
                      <img src={r.imagen_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover border border-slate-100 shadow-sm" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-lg font-bold text-slate-400 shadow-sm">
                        {r.nombre[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 leading-snug truncate">{r.nombre}</p>
                        {enCarrito && (
                          <span className="shrink-0 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            +{enCarrito.cantidad}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-indigo-500 font-medium mt-0.5 truncate">
                        {r.sku}{r.marca ? ` · ${r.marca}` : ""}{r.modelos ? ` · ${r.modelos}` : ""}
                      </p>
                      {r.aplicacion && <p className="text-[10px] text-slate-400 truncate mt-0.5">{r.aplicacion}</p>}
                      {r.medidas && <p className="text-[10px] text-slate-400 mt-0.5">{r.medidas}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-base font-bold text-slate-800">{fmtBs(r.precio_venta)}</p>
                      <p className={`text-[11px] font-semibold mt-0.5 ${stockColor}`}>Stock: {stock} uds</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {repFiltrados.length > 0 && !busqueda && (
            <p className="shrink-0 mt-1 text-[10px] text-slate-400 text-right">
              Mostrando {repFiltrados.length} productos · escribe para filtrar
            </p>
          )}
        </div>
      </div>

      {/* ── Panel derecho — carrito con scroll propio ─────────────────────── */}
      {/* overflow-y-auto + min-h-0: el panel entero scrollea si el contenido
          (ítems + totales + footer) supera la altura disponible del modal     */}
      <div className="w-[340px] shrink-0 min-h-0 flex flex-col border-l border-slate-200 pl-6 overflow-y-auto">
        <p className="sticky top-0 bg-white z-10 text-xs font-semibold uppercase tracking-wider text-slate-400 pb-2 mb-1">
          CARRITO DE VENTA
        </p>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 text-slate-300">
            <ShoppingCart className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">Carrito vacío</p>
            <p className="text-xs mt-1">Haz clic en un repuesto<br />del panel izquierdo</p>
          </div>
        ) : (
          <div className="space-y-2 pr-1">
            {cart.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-semibold text-slate-700 leading-snug flex-1">{item.nombre}</p>
                  <button type="button" onClick={() => removeFromCart(item.id)}
                    className="text-red-400 hover:text-red-600 shrink-0 ml-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <button type="button"
                      onClick={() => setCart((p) => p.map((i) => i.id === item.id ? { ...i, cantidad: Math.max(1, i.cantidad - 1) } : i))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-slate-700">{item.cantidad}</span>
                    <button type="button"
                      onClick={() => setCart((p) => p.map((i) => i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400">{fmtBs(item.precio)} c/u</p>
                    <p className="text-sm font-bold text-slate-800">{fmtBs(item.precio * item.cantidad)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Totales + footer — sticky al fondo del panel */}
        <div className="sticky bottom-0 bg-white pt-3 mt-3 border-t border-slate-200 space-y-2">
          {clienteDescuento > 0 && (
            <>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal:</span><span>{fmtBs(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600 font-semibold">
                <span>Descuento ({clienteDescuento}%):</span>
                <span>-{fmtBs(descuentoMonto)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-lg text-slate-800">
            <span>TOTAL:</span><span>{fmtBs(cartTotal)}</span>
          </div>
          {footer}
        </div>
      </div>
    </div>
  );
}
