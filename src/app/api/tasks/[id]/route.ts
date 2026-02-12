import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess } from "@/lib/permissions";
import type { RowDataPacket } from "mysql2";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, project_id, section_id, title, description, priority, status, assignee_id, due_date, start_date, position, task_type, created_at, updated_at, deleted_at FROM tasks WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    const task = rows[0];
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json({
      ...task,
      due_date: task.due_date?.toString(),
      start_date: task.start_date?.toString(),
      created_at: task.created_at?.toString(),
      updated_at: task.updated_at?.toString(),
      deleted_at: task.deleted_at?.toString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to get task", details: String(e) }, { status: 500 });
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

    const body = await request.json();
    const allowed = ["section_id", "title", "description", "priority", "status", "assignee_id", "due_date", "start_date", "position", "task_type"];
    
    // Format dates to YYYY-MM-DD or null
    const formatDate = (date: unknown): string | null => {
      if (!date || date === "" || date === null) return null;
      if (typeof date === "string") {
        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        // Try to parse and format
        try {
          const d = new Date(date);
          if (isNaN(d.getTime())) return null;
          return d.toISOString().split("T")[0];
        } catch {
          return null;
        }
      }
      return null;
    };

    const updates: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates.push(`${key} = ?`);
        // Format dates before adding to values
        if (key === "due_date" || key === "start_date") {
          values.push(formatDate(body[key]));
        } else {
          values.push(body[key]);
        }
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: "No updates" }, { status: 400 });
    values.push(id);
    await pool.query(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`, values);

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, project_id, section_id, title, description, priority, status, assignee_id, due_date, start_date, position, task_type, created_at, updated_at, deleted_at FROM tasks WHERE id = ?",
      [id]
    );
    const task = rows[0];
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json({
      ...task,
      due_date: task.due_date?.toString(),
      start_date: task.start_date?.toString(),
      created_at: task.created_at?.toString(),
      updated_at: task.updated_at?.toString(),
      deleted_at: task.deleted_at?.toString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update task", details: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, project_id FROM tasks WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    const task = rows[0];
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const canAccess = await hasProjectAccess(userId, task.project_id);
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await pool.query("UPDATE tasks SET deleted_at = NOW() WHERE id = ?", [id]);
    return NextResponse.json({ message: "Task deleted" });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete task", details: String(e) }, { status: 500 });
  }
}
