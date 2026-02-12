import { NextRequest, NextResponse } from "next/server";
import { pool, executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { canManageMembers, getProjectMembers, getUserProjectRole } from "@/lib/permissions";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { MemberRole } from "@/types";

async function handleDbError(error: unknown, defaultMessage: string) {
  if (error instanceof Error) {
    if (error.message.includes("Too many connections")) {
      return NextResponse.json(
        { error: "Database connection limit reached. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: defaultMessage, details: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ error: defaultMessage }, { status: 500 });
}

/**
 * GET /api/projects/[id]/members - List all project members
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

    const hasAccess = await getUserProjectRole(userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const members = await getProjectMembers(projectId);
    return NextResponse.json(members);
  } catch (e) {
    return handleDbError(e, "Failed to get members");
  }
}

/**
 * POST /api/projects/[id]/members - Add a member to project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

    const canManage = await canManageMembers(userId, projectId);
    if (!canManage) {
      return NextResponse.json({ error: "Only owners and admins can add members" }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, role } = body as { user_id?: number; role?: MemberRole };
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
    if (!role || !["owner", "admin", "member"].includes(role)) {
      return NextResponse.json({ error: "role must be 'owner', 'admin', or 'member'" }, { status: 400 });
    }

    // Check if user exists
    const [userRows] = await executeQuery<RowDataPacket[]>("SELECT id FROM users WHERE id = ?", [user_id]);
    if (!userRows[0]) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already a member
    const [existing] = await executeQuery<RowDataPacket[]>(
      "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?",
      [projectId, user_id]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }

    // Check if user is already owner (from projects.owner_id)
    const [projectRows] = await executeQuery<RowDataPacket[]>(
      "SELECT owner_id FROM projects WHERE id = ?",
      [projectId]
    );
    if (projectRows[0]?.owner_id === user_id) {
      return NextResponse.json({ error: "User is already the project owner" }, { status: 400 });
    }

    // Add member (note: role 'owner' in project_members is not allowed - owner is in projects.owner_id)
    const actualRole = role === "owner" ? "admin" : role;
    await executeQuery<ResultSetHeader>(
      "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)",
      [projectId, user_id, actualRole]
    );

    const members = await getProjectMembers(projectId);
    return NextResponse.json(members);
  } catch (e) {
    return handleDbError(e, "Failed to add member");
  }
}

/**
 * PATCH /api/projects/[id]/members - Update member role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

    const canManage = await canManageMembers(userId, projectId);
    if (!canManage) {
      return NextResponse.json({ error: "Only owners and admins can change member roles" }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, role, permission } = body as { user_id?: number; role?: MemberRole; permission?: "view" | "comment" | "edit" | "full_edit" };
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    // Cannot change owner's role (owner is in projects.owner_id, not project_members)
    const [projectRows] = await executeQuery<RowDataPacket[]>(
      "SELECT owner_id FROM projects WHERE id = ?",
      [projectId]
    );
    if (projectRows[0]?.owner_id === user_id) {
      return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];
    if (role !== undefined && ["admin", "member"].includes(role)) {
      updates.push("role = ?");
      values.push(role);
    }
    if (permission !== undefined && ["view", "comment", "edit", "full_edit"].includes(permission)) {
      updates.push("permission = ?");
      values.push(permission);
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: "Provide role and/or permission to update" }, { status: 400 });
    }
    values.push(projectId, user_id);

    const [result] = await executeQuery<ResultSetHeader>(
      `UPDATE project_members SET ${updates.join(", ")} WHERE project_id = ? AND user_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const members = await getProjectMembers(projectId);
    return NextResponse.json(members);
  } catch (e) {
    return handleDbError(e, "Failed to update member");
  }
}

/**
 * DELETE /api/projects/[id]/members - Remove member from project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

    const canManage = await canManageMembers(userId, projectId);
    if (!canManage) {
      return NextResponse.json({ error: "Only owners and admins can remove members" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const user_id = Number(searchParams.get("user_id"));
    if (!user_id) return NextResponse.json({ error: "user_id query param required" }, { status: 400 });

    // Cannot remove owner
    const [projectRows] = await executeQuery<RowDataPacket[]>(
      "SELECT owner_id FROM projects WHERE id = ?",
      [projectId]
    );
    if (projectRows[0]?.owner_id === user_id) {
      return NextResponse.json({ error: "Cannot remove project owner" }, { status: 400 });
    }

    // Remove member
    const [result] = await executeQuery<ResultSetHeader>(
      "DELETE FROM project_members WHERE project_id = ? AND user_id = ?",
      [projectId, user_id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Member removed" });
  } catch (e) {
    return handleDbError(e, "Failed to remove member");
  }
}
