/**
 * Shared domain & API types – single source of truth.
 */

export type ProjectStatus = "on_track" | "at_risk" | "off_track";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "on_track" | "still_waiting" | "completed";
export type TaskType =
  | "software_dev"
  | "dataset"
  | "video_processing"
  | "sports_coaching"
  | "research_docs";
export type MemberRole = "owner" | "admin" | "member";

export interface User {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: number;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Section {
  id: number;
  project_id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  section_id: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assignee_id: number | null;
  due_date: string | null;
  start_date: string | null;
  position: number;
  task_type: TaskType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ApiError {
  error: string;
  details?: string;
}
