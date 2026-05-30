import { api } from "@/shared/api/client";
import type { DashboardStats } from "@/shared/types/api";

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const r = await api.get<DashboardStats>("/dashboard/stats");
    return r.data;
  },
};
