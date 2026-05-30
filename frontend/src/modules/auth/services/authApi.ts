import { api } from "@/shared/api/client";
import type {
  EmpresaPerfil,
  LoginResponse,
  MeResponse,
  TokenResponse,
} from "@/shared/types/api";

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const r = await api.post<LoginResponse>("/auth/login", { email, password });
    return r.data;
  },

  selectEmpresa: async (empresa_id: string): Promise<TokenResponse> => {
    const r = await api.post<TokenResponse>("/auth/select-empresa", { empresa_id });
    return r.data;
  },

  refresh: async (refresh_token: string): Promise<TokenResponse> => {
    const r = await api.post<TokenResponse>("/auth/refresh", { refresh_token });
    return r.data;
  },

  logout: async (): Promise<void> => {
    await api.post("/auth/logout");
  },

  me: async (): Promise<MeResponse> => {
    const r = await api.get<MeResponse>("/auth/me");
    return r.data;
  },

  empresaPerfil: async (): Promise<EmpresaPerfil> => {
    const r = await api.get<EmpresaPerfil>("/auth/empresa");
    return r.data;
  },
};
