/**
 * Shared domain & API types – single source of truth.
 */

export type ProjectStatus = "on_track" | "at_risk" | "off_track";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "on_track" | "still_waiting" | "completed";
export type TaskType =
  | "task"
  | "milestone"
  | "form_response"
  | "meeting_note"
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
  onboarding_completed_at?: string | null;
  workspace_name?: string | null;
  onboarding_use_case?: string | null;
  onboarding_manage_types?: string | null;
}

export interface Space {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  default_permission: string;
  is_private: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: number;
  name: string;
  user_id: number;
  space_id?: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: number;
  folder_id?: number | null;
  space_id?: number | null;
  settings: Record<string, unknown> | null;
  is_public?: boolean;
  share_token?: string | null;
  workspace_shared?: boolean;
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

export type MemberPermission = "view" | "comment" | "edit" | "full_edit";

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: MemberRole;
  permission?: MemberPermission | null;
  created_at: string;
  user?: {
    id: number;
    email: string;
    name: string | null;
    avatar_url: string | null;
  };
}

export interface Comment {
  id: number;
  task_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    email: string;
    name: string | null;
    avatar_url: string | null;
  };
}

export interface Attachment {
  id: number;
  task_id: number;
  user_id: number;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  uploaded_by?: {
    id: number;
    email: string;
    name: string | null;
  };
}

export interface Dashboard {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  settings: Record<string, unknown> | null;
  is_public?: boolean;
  share_token?: string | null;
  workspace_shared?: boolean;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiError {
  error: string;
  details?: string;
}
