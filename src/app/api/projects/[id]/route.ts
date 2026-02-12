import { NextRequest, NextResponse } from "next/server";
import { pool, executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess, canEditProject } from "@/lib/permissions";
import type { RowDataPacket } from "mysql2";

// Helper to handle connection errors
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, description, status, owner_id, folder_id, settings, is_public, share_token, workspace_shared, created_at, updated_at, deleted_at FROM projects WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    const project = rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const hasAccess = await hasProjectAccess(userId, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    let settings = null;
    if (project.settings) {
      try {
        settings = typeof project.settings === "string" ? JSON.parse(project.settings) : project.settings;
      } catch {
        settings = project.settings;
      }
    }
    return NextResponse.json({
      ...project,
      settings,
      created_at: project.created_at?.toString(),
      updated_at: project.updated_at?.toString(),
      deleted_at: project.deleted_at?.toString(),
    });
  } catch (e) {
    return handleDbError(e, "Failed to get project");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const canEdit = await canEditProject(userId, id);
    if (!canEdit) {
      return NextResponse.json({ error: "Only owners and admins can edit project settings" }, { status: 403 });
    }

    const body = await request.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name); }
    if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description); }
    if (body.status !== undefined) { updates.push("status = ?"); values.push(body.status); }
    if (body.settings !== undefined) {
      updates.push("settings = ?");
      values.push(JSON.stringify(body.settings));
    }
    if (body.folder_id !== undefined) {
      updates.push("folder_id = ?");
      values.push(body.folder_id === null ? null : body.folder_id);
    }
    if (updates.length === 0) return NextResponse.json({ error: "No updates" }, { status: 400 });
    values.push(id);
    await executeQuery(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`, values);

    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, description, status, owner_id, folder_id, settings, is_public, share_token, workspace_shared, created_at, updated_at, deleted_at FROM projects WHERE id = ?",
      [id]
    );
    const project = rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    let settings = null;
    if (project.settings) {
      try {
        settings = typeof project.settings === "string" ? JSON.parse(project.settings) : project.settings;
      } catch {
        settings = project.settings;
      }
    }
    return NextResponse.json({
      ...project,
      settings,
      created_at: project.created_at?.toString(),
      updated_at: project.updated_at?.toString(),
      deleted_at: project.deleted_at?.toString(),
    });
  } catch (e) {
    return handleDbError(e, "Failed to update project");
  }
}
