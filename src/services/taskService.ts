import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import { API_ROUTES } from "@/constants";
import type { Task } from "@/types";

export const taskService = {
  listByProject: (projectId: number) =>
    apiGet<Task[]>(`${API_ROUTES.PROJECTS}/${projectId}/tasks`),
  listBySection: (sectionId: number) =>
    apiGet<Task[]>(`${API_ROUTES.SECTIONS}/${sectionId}/tasks`),
  getById: (id: number) => apiGet<Task>(`${API_ROUTES.TASKS}/${id}`),
  create: (body: Partial<Task> & { project_id: number; section_id: number; title: string }) =>
    apiPost<Task>(API_ROUTES.TASKS, body),
  update: (id: number, body: Partial<Task>) =>
    apiPatch<Task>(`${API_ROUTES.TASKS}/${id}`, body),
  delete: (id: number) => apiDelete<void>(`${API_ROUTES.TASKS}/${id}`),
};
