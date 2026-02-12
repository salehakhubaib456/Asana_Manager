import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import { API_ROUTES } from "@/constants";
import type { Task, Comment, Attachment } from "@/types";

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

  // Comments
  getComments: (taskId: number) =>
    apiGet<Comment[]>(`${API_ROUTES.TASKS}/${taskId}/comments`),
  createComment: (taskId: number, content: string) =>
    apiPost<Comment>(`${API_ROUTES.TASKS}/${taskId}/comments`, { content }),

  // Attachments
  getAttachments: (taskId: number) =>
    apiGet<Attachment[]>(`${API_ROUTES.TASKS}/${taskId}/attachments`),
  createAttachment: (taskId: number, body: { file_name: string; file_url: string; file_type?: string; file_size?: number }) =>
    apiPost<Attachment>(`${API_ROUTES.TASKS}/${taskId}/attachments`, body),
  deleteAttachment: (taskId: number, attachmentId: number) =>
    apiDelete<void>(`${API_ROUTES.TASKS}/${taskId}/attachments/${attachmentId}`),
};
