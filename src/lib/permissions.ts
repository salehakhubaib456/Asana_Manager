/**
 * Role-based permissions and access control for projects.
 * Roles: owner (full control), admin (manage members/tasks), member (view/edit tasks)
 */

import { pool, executeQuery } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { MemberRole } from "@/types";

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: MemberRole;
  created_at: string;
  user?: {
    id: number;
    email: string;
    name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Get user's role in a project (owner from projects.owner_id, or from project_members)
 */
export async function getUserProjectRole(
  userId: number,
  projectId: number
): Promise<MemberRole | null> {
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT 
      CASE 
        WHEN p.owner_id = ? THEN 'owner'
        ELSE pm.role
      END as role
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    WHERE p.id = ? AND p.deleted_at IS NULL`,
    [userId, userId, projectId]
  );
  return (rows[0]?.role as MemberRole) || null;
}

/**
 * Check if user has access to a project (is owner or member)
 */
export async function hasProjectAccess(
  userId: number,
  projectId: number
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role !== null;
}

/**
 * Check if user can edit project settings (owner or admin)
 */
export async function canEditProject(
  userId: number,
  projectId: number
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === "owner" || role === "admin";
}

/**
 * Check if user can manage project members (owner or admin)
 */
export async function canManageMembers(
  userId: number,
  projectId: number
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === "owner" || role === "admin";
}

/**
 * Check if user is project owner
 */
export async function isProjectOwner(
  userId: number,
  projectId: number
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === "owner";
}

/**
 * Get all members of a project with user details
 */
export async function getProjectMembers(
  projectId: number
): Promise<ProjectMember[]> {
  // Get owner
  const [ownerRows] = await executeQuery<RowDataPacket[]>(
    `SELECT 
      p.id as project_id,
      p.owner_id as user_id,
      'owner' as role,
      p.created_at,
      u.email,
      u.name,
      u.avatar_url
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    WHERE p.id = ? AND p.deleted_at IS NULL`,
    [projectId]
  );

  // Get other members (include permission for invite-based members)
  const [memberRows] = await executeQuery<RowDataPacket[]>(
    `SELECT 
      pm.id,
      pm.project_id,
      pm.user_id,
      pm.role,
      pm.permission,
      pm.created_at,
      u.email,
      u.name,
      u.avatar_url
    FROM project_members pm
    LEFT JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?`,
    [projectId]
  );

  const allMembers: ProjectMember[] = [];

  // Add owner
  if (ownerRows[0]) {
    allMembers.push({
      id: 0,
      project_id: ownerRows[0].project_id,
      user_id: ownerRows[0].user_id,
      role: "owner" as MemberRole,
      created_at: ownerRows[0].created_at?.toString() || new Date().toISOString(),
      user: {
        id: ownerRows[0].user_id,
        email: ownerRows[0].email,
        name: ownerRows[0].name,
        avatar_url: ownerRows[0].avatar_url,
      },
    });
  }

  // Add other members (excluding owner if they're also in project_members)
  const ownerId = ownerRows[0]?.user_id;
  for (const row of memberRows) {
    if (row.user_id !== ownerId) {
      allMembers.push({
        id: row.id,
        project_id: row.project_id,
        user_id: row.user_id,
        role: row.role as MemberRole,
        permission: row.permission ?? undefined,
        created_at: row.created_at?.toString() || new Date().toISOString(),
        user: {
          id: row.user_id,
          email: row.email,
          name: row.name,
          avatar_url: row.avatar_url,
        },
      });
    }
  }

  return allMembers;
}
