import { NextRequest, NextResponse } from "next/server";
import { pool, executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess, canEditProject } from "@/lib/permissions";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

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
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const hasAccess = await hasProjectAccess(userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, project_id, name, position, created_at, updated_at FROM sections WHERE project_id = ? ORDER BY position, id",
      [projectId]
    );
    const list = rows.map((r) => ({
      ...r,
      created_at: r.created_at?.toString(),
      updated_at: r.updated_at?.toString(),
    }));
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: "Failed to list sections", details: String(e) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const canEdit = await canEditProject(userId, projectId);
    if (!canEdit) {
      return NextResponse.json({ error: "Only owners and admins can create sections" }, { status: 403 });
    }

    const body = await request.json();
    const { name, position } = body as { name: string; position?: number };
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    const pos = position ?? 0;
    const [result] = await executeQuery<ResultSetHeader>(
      "INSERT INTO sections (project_id, name, position) VALUES (?, ?, ?)",
      [projectId, name.trim(), pos]
    );
    const id = result.insertId;
    if (!id) return NextResponse.json({ error: "Failed to create section" }, { status: 500 });

    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, project_id, name, position, created_at, updated_at FROM sections WHERE id = ?",
      [id]
    );
    const section = rows[0];
    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 500 });
    return NextResponse.json({
      ...section,
      created_at: section.created_at?.toString(),
      updated_at: section.updated_at?.toString(),
    });
  } catch (e) {
    return handleDbError(e, "Failed to create section");
  }
}
