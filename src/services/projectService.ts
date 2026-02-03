import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import { API_ROUTES } from "@/constants";
import type { Project, Section } from "@/types";

export const projectService = {
  list: () => apiGet<Project[]>(API_ROUTES.PROJECTS),
  getById: (id: number) => apiGet<Project>(`${API_ROUTES.PROJECTS}/${id}`),
  create: (body: Pick<Project, "name" | "description" | "status">) =>
    apiPost<Project>(API_ROUTES.PROJECTS, body),
  update: (id: number, body: Partial<Project>) =>
    apiPatch<Project>(`${API_ROUTES.PROJECTS}/${id}`, body),
  delete: (id: number) => apiDelete<void>(`${API_ROUTES.PROJECTS}/${id}`),

  getSections: (projectId: number) =>
    apiGet<Section[]>(`${API_ROUTES.PROJECTS}/${projectId}/sections`),
  createSection: (projectId: number, body: { name: string; position?: number }) =>
    apiPost<Section>(`${API_ROUTES.PROJECTS}/${projectId}/sections`, body),
};
