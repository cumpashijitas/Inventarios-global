/**
 * Store del texto de búsqueda de InventarioPage.
 *
 * Antes vivía como useState local — se perdía al navegar a otra sección
 * (por ej. a Ventas) y volver, porque React desmonta el componente al
 * cambiar de ruta. Sacarlo a un store (mismo patrón que ventaDraft.store.ts)
 * hace que sobreviva ese desmontaje: el texto queda escrito hasta que el
 * usuario lo borra a mano — no hay limpieza automática acá, a diferencia del
 * borrador de venta, porque no hay un "evento de confirmación" que marque
 * cuándo debería vaciarse solo.
 *
 * Persistido en sessionStorage: sobrevive navegar entre secciones y un F5
 * accidental, sin compartirse entre pestañas.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface InventarioBusquedaState {
  busqueda: string;
  setBusqueda: (v: string) => void;
}

export const useInventarioBusquedaStore = create<InventarioBusquedaState>()(
  persist(
    (set) => ({
      busqueda: "",
      setBusqueda: (v) => set({ busqueda: v }),
    }),
    {
      name: "inventario-busqueda",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
