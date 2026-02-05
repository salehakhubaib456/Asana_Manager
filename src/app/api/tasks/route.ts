import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { project_id, section_id, title, description, priority, status, assignee_id, due_date, start_date, task_type } = body as Record<string, unknown>;
    if (!project_id || !section_id || !title) {
      return NextResponse.json({ error: "project_id, section_id, title required" }, { status: 400 });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO tasks (project_id, section_id, title, description, priority, status, assignee_id, due_date, start_date, position, task_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        Number(project_id),
        Number(section_id),
        String(title).trim(),
        description ? String(description).trim() : null,
        priority || "medium",
        status || "on_track",
        assignee_id ? Number(assignee_id) : null,
        due_date ? String(due_date) : null,
        start_date ? String(start_date) : null,
        task_type || "software_dev",
      ]
    );
    const id = result.insertId;
    if (!id) return NextResponse.json({ error: "Failed to create task" }, { status: 500 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, project_id, section_id, title, description, priority, status, assignee_id, due_date, start_date, position, task_type, created_at, updated_at, deleted_at FROM tasks WHERE id = ?",
      [id]
    );
    const task = rows[0];
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 500 });
    return NextResponse.json({
      ...task,
      due_date: task.due_date?.toString(),
      start_date: task.start_date?.toString(),
      created_at: task.created_at?.toString(),
      updated_at: task.updated_at?.toString(),
      deleted_at: task.deleted_at?.toString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create task", details: String(e) }, { status: 500 });
  }
}
