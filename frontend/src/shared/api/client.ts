/**
 * Axios client con interceptors para JWT + refresh + manejo de errores.
 *
 * - Inyecta Authorization: Bearer <access_token> en cada request.
 * - Si una request falla con 401 y existe refresh_token, lo intenta una vez.
 *   Si el refresh también falla → logout y redirect a /login.
 * - Normaliza errores del backend (formato { error: { code, message, details } })
 *   a un objeto consistente que los componentes pueden mostrar.
 */
import axios, { AxiosError, type AxiosInstance } from "axios";

import { useAuthStore } from "@/shared/stores/auth.store";
import type { ApiError } from "@/shared/types/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ---- Request: inyectar JWT ----
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Response: refresh + normalización de errores ----
let refreshing: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const { refreshToken, setTokens } = useAuthStore.getState();
    if (!refreshToken) return null;
    try {
      const r = await axios.post(`${API_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      setTokens(r.data);
      return r.data.access_token as string;
    } catch {
      useAuthStore.getState().logout();
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as
      | (typeof error.config & { _retry?: boolean })
      | undefined;

    if (error.response?.status === 403) {
      const msg = (error.response.data as { detail?: string })?.detail ?? "";
      if (
        (msg.includes("Acceso denegado") || msg.includes("autorizada")) &&
        !useAuthStore.getState().networkBlocked
      ) {
        useAuthStore.getState().setNetworkBlocked(true);
      }
    }

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/")
    ) {
      original._retry = true;
      const newToken = await attemptRefresh();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh falló → forzar redirect
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

/** Extrae un mensaje legible de un AxiosError. Útil para toasts. */
export function extractApiError(err: unknown): { code: string; message: string; details?: unknown } {
  if (axios.isAxiosError<ApiError>(err)) {
    const body = err.response?.data;
    if (body?.error) {
      return body.error;
    }
    return {
      code: "network_error",
      message: err.message || "Error de red",
    };
  }
  if (err instanceof Error) return { code: "unknown", message: err.message };
  return { code: "unknown", message: "Error desconocido" };
}
