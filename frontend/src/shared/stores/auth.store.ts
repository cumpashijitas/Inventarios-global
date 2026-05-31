/**
 * Store de autenticación.
 *
 * Persiste tokens y empresa activa en localStorage para que el usuario no
 * tenga que loguearse en cada reload. El token se valida cuando se hace
 * la primera request autenticada (si el backend devuelve 401, limpiamos).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { EmpresaResumen, TokenResponse } from "@/shared/types/api";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  empresaId: string | null;
  rol: string | null;
  email: string | null;
  empresasDisponibles: EmpresaResumen[];
  networkBlocked: boolean;

  setTokens: (t: TokenResponse) => void;
  setEmail: (email: string) => void;
  setEmpresasDisponibles: (empresas: EmpresaResumen[]) => void;
  setNetworkBlocked: (blocked: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      empresaId: null,
      rol: null,
      email: null,
      empresasDisponibles: [],
      networkBlocked: false,

      setTokens: (t) =>
        set({
          accessToken: t.access_token,
          refreshToken: t.refresh_token,
          empresaId: t.empresa_id ?? null,
          rol: t.rol ?? null,
        }),
      setEmail: (email) => set({ email }),
      setEmpresasDisponibles: (empresas) => set({ empresasDisponibles: empresas }),
      setNetworkBlocked: (blocked) => set({ networkBlocked: blocked }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          empresaId: null,
          rol: null,
          email: null,
          empresasDisponibles: [],
        }),
    }),
    {
      name: "inventario-auth",
      // Solo persistir lo necesario; nada de info derivable del JWT
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        empresaId: state.empresaId,
        rol: state.rol,
        email: state.email,
      }),
    },
  ),
);

/** Selectores: usar en componentes para evitar re-renders innecesarios. */
export const selectIsAuthenticated = (s: AuthState): boolean =>
  Boolean(s.accessToken && s.empresaId);
export const selectAccessToken = (s: AuthState): string | null => s.accessToken;
