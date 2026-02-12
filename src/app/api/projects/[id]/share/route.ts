import { NextRequest, NextResponse } from "next/server";
import { pool, executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { canManageMembers, isProjectOwner } from "@/lib/permissions";
import type { RowDataPacket } from "mysql2";
import crypto from "crypto";

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
 * GET /api/projects/[id]/share - Get project sharing information
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

    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, is_public, share_token, workspace_shared, owner_id FROM projects WHERE id = ? AND deleted_at IS NULL",
      [projectId]
    );
    
    const project = rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Check if user has access
    const isOwner = project.owner_id === userId;
    if (!isOwner) {
      // Check if user is a member
      const [memberRows] = await executeQuery<RowDataPacket[]>(
        "SELECT user_id FROM project_members WHERE project_id = ? AND user_id = ?",
        [projectId, userId]
      );
      if (memberRows.length === 0) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Get all members for sharing list
    const [memberRows] = await executeQuery<RowDataPacket[]>(
      `SELECT pm.user_id, pm.role, u.email, u.name, u.avatar_url
       FROM project_members pm
       LEFT JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?`,
      [projectId]
    );

    const members = memberRows.map((row) => ({
      user_id: row.user_id,
      role: row.role,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url,
    }));

    // Generate share link if token exists
    const shareLink = project.share_token
      ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/project/${project.share_token}`
      : null;

    return NextResponse.json({
      project_id: project.id,
      project_name: project.name,
      is_public: Boolean(project.is_public),
      workspace_shared: Boolean(project.workspace_shared),
      share_token: project.share_token,
      share_link: shareLink,
      members,
      can_manage: isOwner,
    });
  } catch (e) {
    return handleDbError(e, "Failed to get sharing info");
  }
}

/**
 * POST /api/projects/[id]/share - Invite user by email
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
      return NextResponse.json({ error: "Only owners and admins can invite members" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body as { email?: string; role?: "admin" | "member" };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by email
    const [userRows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, email, name FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const targetUser = userRows[0];

    // Check if already a member
    const [existingRows] = await executeQuery<RowDataPacket[]>(
      "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?",
      [projectId, targetUser.id]
    );

    if (existingRows.length > 0) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }

    // Check if user is owner
    const [projectRows] = await executeQuery<RowDataPacket[]>(
      "SELECT owner_id FROM projects WHERE id = ?",
      [projectId]
    );
    if (projectRows[0]?.owner_id === targetUser.id) {
      return NextResponse.json({ error: "User is already the project owner" }, { status: 400 });
    }

    // Add member
    await executeQuery(
      "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)",
      [projectId, targetUser.id, role || "member"]
    );

    return NextResponse.json({ 
      message: "User invited successfully",
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      }
    });
  } catch (e) {
    return handleDbError(e, "Failed to invite user");
  }
}

/**
 * PATCH /api/projects/[id]/share - Update sharing settings
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

    const isOwner = await isProjectOwner(userId, projectId);
    if (!isOwner) {
      return NextResponse.json({ error: "Only project owner can change sharing settings" }, { status: 403 });
    }

    const body = await request.json();
    const { is_public, workspace_shared, generate_token } = body as {
      is_public?: boolean;
      workspace_shared?: boolean;
      generate_token?: boolean;
    };

    const updates: string[] = [];
    const values: unknown[] = [];

    if (is_public !== undefined) {
      updates.push("is_public = ?");
      values.push(is_public);
    }

    if (workspace_shared !== undefined) {
      updates.push("workspace_shared = ?");
      values.push(workspace_shared);
    }

    if (generate_token) {
      // Generate unique share token
      const token = crypto.randomBytes(32).toString("hex");
      updates.push("share_token = ?");
      values.push(token);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    values.push(projectId);
    await executeQuery(
      `UPDATE projects SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // Return updated project info
    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, is_public, share_token, workspace_shared FROM projects WHERE id = ?",
      [projectId]
    );

    const project = rows[0];
    const shareLink = project.share_token
      ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/project/${project.share_token}`
      : null;

    return NextResponse.json({
      project_id: project.id,
      is_public: Boolean(project.is_public),
      workspace_shared: Boolean(project.workspace_shared),
      share_token: project.share_token,
      share_link: shareLink,
    });
  } catch (e) {
    return handleDbError(e, "Failed to update sharing settings");
  }
}
