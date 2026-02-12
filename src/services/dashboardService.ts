import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import { API_ROUTES } from "@/constants";
import type { Dashboard } from "@/types";

export const dashboardService = {
  list: () => apiGet<Dashboard[]>(API_ROUTES.DASHBOARDS),
  getById: (id: number) => apiGet<Dashboard>(`${API_ROUTES.DASHBOARDS}/${id}`),
  create: (body: { name?: string; description?: string }) =>
    apiPost<Dashboard>(API_ROUTES.DASHBOARDS, body),
  update: (id: number, body: Partial<Pick<Dashboard, "name" | "description">>) =>
    apiPatch<Dashboard>(`${API_ROUTES.DASHBOARDS}/${id}`, body),
  delete: (id: number) => apiDelete<{ message: string }>(`${API_ROUTES.DASHBOARDS}/${id}`),

  getSharing: (dashboardId: number) =>
    apiGet<{
      dashboard_id: number;
      dashboard_name: string;
      is_public: boolean;
      workspace_shared: boolean;
      share_token: string | null;
      share_link: string | null;
      members: Array<{
        user_id: number;
        role: string;
        email: string;
        name: string | null;
        avatar_url: string | null;
      }>;
      can_manage: boolean;
    }>(`${API_ROUTES.DASHBOARDS}/${dashboardId}/share`),
  inviteUser: (dashboardId: number, body: { email: string; role?: "admin" | "member" }) =>
    apiPost<{ message: string; user: { id: number; email: string; name: string | null } }>(
      `${API_ROUTES.DASHBOARDS}/${dashboardId}/share`,
      body
    ),
  updateSharing: (
    dashboardId: number,
    body: { is_public?: boolean; workspace_shared?: boolean; generate_token?: boolean }
  ) =>
    apiPatch<{
      dashboard_id: number;
      is_public: boolean;
      workspace_shared: boolean;
      share_token: string | null;
      share_link: string | null;
    }>(`${API_ROUTES.DASHBOARDS}/${dashboardId}/share`, body),
};
