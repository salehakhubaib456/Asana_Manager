import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess } from "@/lib/permissions";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/tasks/[id]/attachments - Get all attachments for a task
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const taskId = Number((await params).id);
    if (!taskId) return NextResponse.json({ error: "Invalid task id" }, { status: 400 });

    // Get task to check project access
    const [taskRows] = await pool.query<RowDataPacket[]>(
      "SELECT project_id FROM tasks WHERE id = ? AND deleted_at IS NULL",
      [taskId]
    );
    const task = taskRows[0];
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const hasAccess = await hasProjectAccess(userId, task.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id, a.task_id, a.user_id, a.file_name, a.file_url, a.file_type, a.file_size, a.created_at,
              u.email, u.name
       FROM attachments a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.task_id = ?
       ORDER BY a.created_at DESC`,
      [taskId]
    );

    const attachments = rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      user_id: r.user_id,
      file_name: r.file_name,
      file_url: r.file_url,
      file_type: r.file_type,
      file_size: r.file_size,
      created_at: r.created_at?.toString(),
      uploaded_by: {
        id: r.user_id,
        email: r.email,
        name: r.name,
      },
    }));

    return NextResponse.json(attachments);
  } catch (e) {
    return NextResponse.json({ error: "Failed to get attachments", details: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/tasks/[id]/attachments - Upload a file attachment
 * Note: For now, we'll accept file_url in the body. In production, you'd handle file upload via FormData.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const taskId = Number((await params).id);
    if (!taskId) return NextResponse.json({ error: "Invalid task id" }, { status: 400 });

    const body = await request.json();
    const { file_name, file_url, file_type, file_size } = body as {
      file_name?: string;
      file_url?: string;
      file_type?: string;
      file_size?: number;
    };

    if (!file_name?.trim() || !file_url?.trim()) {
      return NextResponse.json({ error: "file_name and file_url required" }, { status: 400 });
    }

    // Get task to check project access
    const [taskRows] = await pool.query<RowDataPacket[]>(
      "SELECT project_id FROM tasks WHERE id = ? AND deleted_at IS NULL",
      [taskId]
    );
    const task = taskRows[0];
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const hasAccess = await hasProjectAccess(userId, task.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO attachments (task_id, user_id, file_name, file_url, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
      [taskId, userId, file_name.trim(), file_url.trim(), file_type || null, file_size || null]
    );

    const attachmentId = result.insertId;
    if (!attachmentId) return NextResponse.json({ error: "Failed to create attachment" }, { status: 500 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id, a.task_id, a.user_id, a.file_name, a.file_url, a.file_type, a.file_size, a.created_at,
              u.email, u.name
       FROM attachments a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.id = ?`,
      [attachmentId]
    );

    const attachment = rows[0];
    return NextResponse.json({
      id: attachment.id,
      task_id: attachment.task_id,
      user_id: attachment.user_id,
      file_name: attachment.file_name,
      file_url: attachment.file_url,
      file_type: attachment.file_type,
      file_size: attachment.file_size,
      created_at: attachment.created_at?.toString(),
      uploaded_by: {
        id: attachment.user_id,
        email: attachment.email,
        name: attachment.name,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create attachment", details: String(e) }, { status: 500 });
  }
}
