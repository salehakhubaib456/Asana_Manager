import { NextResponse } from "next/server";
import { pool, executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess } from "@/lib/permissions";
import type { RowDataPacket } from "mysql2";

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
      `SELECT t.id, t.project_id, t.section_id, t.title, t.description, t.priority, t.status, t.assignee_id, t.due_date, t.start_date, t.position, t.task_type, t.created_at, t.updated_at, t.deleted_at
       FROM tasks t
       WHERE t.project_id = ? AND t.deleted_at IS NULL
       ORDER BY t.section_id, t.position, t.id`,
      [projectId]
    );
    const list = rows.map((r) => ({
      ...r,
      due_date: r.due_date?.toString(),
      start_date: r.start_date?.toString(),
      created_at: r.created_at?.toString(),
      updated_at: r.updated_at?.toString(),
      deleted_at: r.deleted_at?.toString(),
    }));
    return NextResponse.json(list);
  } catch (e) {
    return handleDbError(e, "Failed to list tasks");
  }
}
