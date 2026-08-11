import { api } from "@/shared/api/client";

export interface RolAdmin {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  es_sistema: boolean;
}

export interface UsuarioAdmin {
  id: string;
  user_id: string;
  nombre: string;
  email: string;
  rol_codigos: string[];
  activo: boolean;
  created_at: string;
}

export interface UsuarioCreateIn {
  nombre: string;
  email: string;
  password: string;
  rol_codigos: string[];
}

export interface UsuarioUpdateIn {
  nombre?: string;
  rol_codigos?: string[];
  activo?: boolean;
}

export interface EmpresaConfig {
  id: string;
  razon_social: string;
  nombre_comercial?: string | null;
  nit?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  telefono?: string | null;
  email?: string | null;
  logo_url?: string | null;
  moneda_principal?: string | null;
}

export interface SistemaConfig {
  notificaciones_email: boolean;
  alertas_stock_bajo:   boolean;
}

export interface IpPermitida {
  id: string;
  ip: string;
  descripcion: string;
  created_at: string;
}

export const adminApi = {
  // ── Roles ──────────────────────────────────────────────────────────────────
  listRoles: async (): Promise<RolAdmin[]> => {
    const r = await api.get<RolAdmin[]>("/admin/roles");
    return r.data;
  },

  // ── Usuarios ───────────────────────────────────────────────────────────────
  listUsuarios: async (): Promise<UsuarioAdmin[]> => {
    const r = await api.get<UsuarioAdmin[]>("/admin/usuarios");
    return r.data;
  },

  createUsuario: async (body: UsuarioCreateIn): Promise<UsuarioAdmin> => {
    const r = await api.post<UsuarioAdmin>("/admin/usuarios", body);
    return r.data;
  },

  updateUsuario: async (id: string, body: UsuarioUpdateIn): Promise<UsuarioAdmin> => {
    const r = await api.put<UsuarioAdmin>(`/admin/usuarios/${id}`, body);
    return r.data;
  },

  deactivateUsuario: async (id: string): Promise<void> => {
    await api.delete(`/admin/usuarios/${id}`);
  },

  // ── Empresa ────────────────────────────────────────────────────────────────
  getEmpresa: async (): Promise<EmpresaConfig> => {
    const r = await api.get<EmpresaConfig>("/admin/empresa");
    return r.data;
  },

  updateEmpresa: async (body: Partial<EmpresaConfig>): Promise<EmpresaConfig> => {
    const r = await api.put<EmpresaConfig>("/admin/empresa", body);
    return r.data;
  },

  // ── Sistema ────────────────────────────────────────────────────────────────
  getSistema: async (): Promise<SistemaConfig> => {
    const r = await api.get<SistemaConfig>("/admin/sistema");
    return r.data;
  },

  updateSistema: async (body: Partial<SistemaConfig>): Promise<SistemaConfig> => {
    const r = await api.put<SistemaConfig>("/admin/sistema", body);
    return r.data;
  },

  // ── IP Permitidas ──────────────────────────────────────────────────────────
  getMiIp: async (): Promise<string> => {
    const r = await api.get<{ ip: string }>("/admin/mi-ip");
    return r.data.ip;
  },

  listIps: async (): Promise<IpPermitida[]> => {
    const r = await api.get<IpPermitida[]>("/admin/ip-permitidas");
    return r.data;
  },

  addIp: async (ip: string, descripcion: string): Promise<IpPermitida> => {
    const r = await api.post<IpPermitida>("/admin/ip-permitidas", { ip, descripcion });
    return r.data;
  },

  deleteIp: async (id: string): Promise<void> => {
    await api.delete(`/admin/ip-permitidas/${id}`);
  },
};
