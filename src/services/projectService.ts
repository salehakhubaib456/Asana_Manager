import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import { API_ROUTES } from "@/constants";
import type { Project, Section, ProjectMember, MemberRole, ProjectStatus } from "@/types";

export const projectService = {
  list: () => apiGet<Project[]>(API_ROUTES.PROJECTS),
  getById: (id: number) => apiGet<Project>(`${API_ROUTES.PROJECTS}/${id}`),
  create: (body: {
    name: string;
    description?: string | null;
    status?: ProjectStatus;
    space_id?: number | null;
    folder_id?: number | null;
    is_public?: boolean;
  }) => apiPost<Project>(API_ROUTES.PROJECTS, body),
  update: (id: number, body: Partial<Project>) =>
    apiPatch<Project>(`${API_ROUTES.PROJECTS}/${id}`, body),
  delete: (id: number) => apiDelete<void>(`${API_ROUTES.PROJECTS}/${id}`),

  getSections: (projectId: number) =>
    apiGet<Section[]>(`${API_ROUTES.PROJECTS}/${projectId}/sections`),
  createSection: (projectId: number, body: { name: string; position?: number }) =>
    apiPost<Section>(`${API_ROUTES.PROJECTS}/${projectId}/sections`, body),

  getMembers: (projectId: number) =>
    apiGet<ProjectMember[]>(`${API_ROUTES.PROJECTS}/${projectId}/members`),
  addMember: (projectId: number, body: { user_id: number; role: MemberRole }) =>
    apiPost<ProjectMember[]>(`${API_ROUTES.PROJECTS}/${projectId}/members`, body),
  updateMemberRole: (projectId: number, body: { user_id: number; role: MemberRole }) =>
    apiPatch<ProjectMember[]>(`${API_ROUTES.PROJECTS}/${projectId}/members`, body),
  removeMember: (projectId: number, userId: number) =>
    apiDelete<{ message: string }>(`${API_ROUTES.PROJECTS}/${projectId}/members?user_id=${userId}`),

  getStats: (projectId: number) =>
    apiGet<{
      total_tasks: number;
      completed_tasks: number;
      on_track_tasks: number;
      waiting_tasks: number;
      overdue_tasks: number;
      progress_percentage: number;
    }>(`${API_ROUTES.PROJECTS}/${projectId}/stats`),

  getSharing: (projectId: number) =>
    apiGet<{
      project_id: number;
      project_name: string;
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
    }>(`${API_ROUTES.PROJECTS}/${projectId}/share`),
  
  inviteUser: (projectId: number, body: { email: string; role?: "admin" | "member" }) =>
    apiPost<{ message: string; user: { id: number; email: string; name: string | null } }>(
      `${API_ROUTES.PROJECTS}/${projectId}/share`,
      body
    ),
  
  updateSharing: (projectId: number, body: { is_public?: boolean; workspace_shared?: boolean; generate_token?: boolean }) =>
    apiPatch<{
      project_id: number;
      is_public: boolean;
      workspace_shared: boolean;
      share_token: string | null;
      share_link: string | null;
    }>(`${API_ROUTES.PROJECTS}/${projectId}/share`, body),
};
