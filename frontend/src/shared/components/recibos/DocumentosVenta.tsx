/**
 * Documentos de Venta / Cotización — recibo listo para imprimir, guardar
 * como imagen o compartir por WhatsApp. Antes vivían duplicados (copiados
 * casi letra por letra) en NuevaVentaPage.tsx y VentasPage.tsx; ahora es una
 * sola fuente para las dos pantallas.
 */
import { Download, Loader2, Printer, Share2 } from "lucide-react";
import { forwardRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import type { Cotizacion, EmpresaPerfil, Venta } from "@/shared/types/api";
import { fmtBs } from "@/shared/utils/format";
import { compartirImagen, guardarImagen } from "@/shared/utils/compartirImagen";

const METODOS_PAGO: Record<string, string> = {
  efectivo: "Efectivo", tarjeta_debito: "Tarjeta de Débito",
  tarjeta_credito: "Tarjeta de Crédito", transferencia: "Transferencia", mixto: "Mixto",
};

export function EmpresaHeader({ empresa }: { empresa: EmpresaPerfil | null }) {
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

export const ReciboVenta = forwardRef<HTMLDivElement, { venta: Venta; empresa: EmpresaPerfil | null }>(
  function ReciboVenta({ venta, empresa }, ref) {
    const descuento = parseFloat(venta.descuento_monto ?? "0");
    return (
      <div ref={ref} className="font-mono text-xs space-y-1 max-w-[320px] mx-auto bg-white p-2" id="print-doc">
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
  },
);

export const DocCotizacion = forwardRef<HTMLDivElement, { cot: Cotizacion; empresa: EmpresaPerfil | null }>(
  function DocCotizacion({ cot, empresa }, ref) {
    const descuento = parseFloat(cot.descuento_monto ?? "0");
    const subtotal  = parseFloat(cot.subtotal ?? "0");
    const descPct   = subtotal > 0 ? Math.round((descuento / subtotal) * 100) : 0;
    return (
      <div ref={ref} className="font-mono text-xs space-y-1 max-w-[320px] mx-auto bg-white p-2" id="print-doc">
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
  },
);

// ─── Texto para WhatsApp (respaldo cuando no se puede adjuntar la imagen) ────

export function textoWhatsappVenta(venta: Venta, empresa: EmpresaPerfil | null): string {
  const desc = parseFloat(venta.descuento_monto ?? "0");
  const empNombre = empresa?.nombre_comercial ?? empresa?.razon_social ?? "Autorepuestos";
  let texto = `*${empNombre.toUpperCase()}*\n`;
  if (empresa?.telefono) texto += `Tel: ${empresa.telefono}\n`;
  texto += `\n*RECIBO DE VENTA ${venta.numero}*\n`;
  texto += `Fecha: ${venta.fecha}\n\n`;
  texto += `*DETALLE:*\n`;
  venta.items.forEach((i) => {
    texto += `• ${i.nombre}\n  ${i.cantidad}u × ${fmtBs(i.precio_unitario)} = *${fmtBs(i.subtotal)}*\n`;
  });
  if (desc > 0) {
    texto += `\nSubtotal: ${fmtBs(venta.subtotal)}\nDescuento: -${fmtBs(venta.descuento_monto)}\n`;
  }
  texto += `\n*TOTAL A PAGAR: ${fmtBs(venta.total)}*\n`;
  texto += `\n_¡Gracias por su compra!_`;
  return texto;
}

export function textoWhatsappCotizacion(cot: Cotizacion, empresa: EmpresaPerfil | null): string {
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
  return texto;
}

// ─── Barra de acciones: Imprimir / Guardar / Compartir ───────────────────────

export function AccionesDocumento({
  docRef, nombreArchivo, textoWhatsapp,
}: {
  docRef: React.RefObject<HTMLDivElement | null>;
  nombreArchivo: string;
  textoWhatsapp: string;
}) {
  const [procesando, setProcesando] = useState<"guardar" | "compartir" | null>(null);

  const handleGuardar = async () => {
    if (!docRef.current) return;
    setProcesando("guardar");
    try {
      await guardarImagen(docRef.current, nombreArchivo);
    } catch {
      toast.error("No se pudo generar la imagen. Intenta de nuevo.");
    } finally {
      setProcesando(null);
    }
  };

  const handleCompartir = async () => {
    if (!docRef.current) return;
    setProcesando("compartir");
    try {
      await compartirImagen(docRef.current, nombreArchivo, textoWhatsapp);
    } catch {
      toast.error("No se pudo compartir. Intenta de nuevo.");
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" /> Imprimir
      </Button>
      <Button
        variant="outline" size="sm" className="gap-1 text-xs"
        onClick={handleGuardar} disabled={procesando !== null}
      >
        {procesando === "guardar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Guardar
      </Button>
      <Button
        size="sm" className="gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
        onClick={handleCompartir} disabled={procesando !== null}
      >
        {procesando === "compartir" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
        Compartir
      </Button>
    </div>
  );
}
