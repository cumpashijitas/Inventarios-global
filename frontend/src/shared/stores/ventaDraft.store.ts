/**
 * Store del "borrador" de venta/cotización en curso en NuevaVentaPage.
 *
 * Antes este estado vivía como useState local de la página — se perdía por
 * completo si el usuario navegaba a otra sección (Inventario, Reportes, Caja)
 * y volvía, porque React desmonta el componente al cambiar de ruta. Sacarlo a
 * un store (mismo patrón que auth.store.ts) hace que sobreviva ese
 * desmontaje: el carrito, cliente, método de pago, etc. quedan tal cual se
 * dejaron hasta que la venta/cotización se confirma (ahí se llama a
 * resetDraft()) o el usuario cierra la pestaña/navegador.
 *
 * Persistido en sessionStorage (no localStorage): sobrevive navegar entre
 * secciones y un F5 accidental, pero no se comparte entre pestañas — dos
 * cajeros en dos pestañas no se pisan el borrador, y se limpia solo al
 * cerrar la pestaña.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Cotizacion, VentaIn } from "@/shared/types/api";

export interface CartItem {
  id: string; sku: string; nombre: string;
  precio: number;
  precio_venta: number;
  precio_mayor?: number | null;
  precio_mecanico?: number | null;
  precio_real?: number | null;
  cantidad: number; stock: number;
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
};

interface DraftValues {
  cart: CartItem[];
  clienteNombre: string;
  clienteId: string | null;
  clienteTipo: string | null;
  clienteDescuento: number;
  metodoPago: VentaIn["metodo_pago"];
  montoPagado: string;
  notas: string;
  fechaVenta: string;
  fechaCot: string;
  fechaVence: string;
  cotizacionOrigen: Cotizacion | null;
}

function valoresIniciales(): DraftValues {
  return {
    cart: [],
    clienteNombre: "",
    clienteId: null,
    clienteTipo: null,
    clienteDescuento: 0,
    metodoPago: "efectivo",
    montoPagado: "",
    notas: "",
    fechaVenta: todayStr(),
    fechaCot: todayStr(),
    fechaVence: addDays(todayStr(), 7),
    cotizacionOrigen: null,
  };
}

interface VentaDraftState extends DraftValues {
  setCart: (v: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void;
  setClienteNombre: (v: string) => void;
  setClienteId: (v: string | null) => void;
  setClienteTipo: (v: string | null) => void;
  setClienteDescuento: (v: number) => void;
  setMetodoPago: (v: VentaIn["metodo_pago"]) => void;
  setMontoPagado: (v: string) => void;
  setNotas: (v: string) => void;
  setFechaVenta: (v: string) => void;
  setFechaCot: (v: string) => void;
  setFechaVence: (v: string) => void;
  setCotizacionOrigen: (v: Cotizacion | null) => void;
  /** Vuelve el borrador a cero. Se llama al confirmar la venta/cotización. */
  resetDraft: () => void;
}

export const useVentaDraftStore = create<VentaDraftState>()(
  persist(
    (set) => ({
      ...valoresIniciales(),
      setCart: (v) =>
        set((s) => ({ cart: typeof v === "function" ? (v as (p: CartItem[]) => CartItem[])(s.cart) : v })),
      setClienteNombre: (v) => set({ clienteNombre: v }),
      setClienteId: (v) => set({ clienteId: v }),
      setClienteTipo: (v) => set({ clienteTipo: v }),
      setClienteDescuento: (v) => set({ clienteDescuento: v }),
      setMetodoPago: (v) => set({ metodoPago: v }),
      setMontoPagado: (v) => set({ montoPagado: v }),
      setNotas: (v) => set({ notas: v }),
      setFechaVenta: (v) => set({ fechaVenta: v }),
      setFechaCot: (v) => set({ fechaCot: v }),
      setFechaVence: (v) => set({ fechaVence: v }),
      setCotizacionOrigen: (v) => set({ cotizacionOrigen: v }),
      resetDraft: () => set(valoresIniciales()),
    }),
    {
      name: "venta-draft",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
