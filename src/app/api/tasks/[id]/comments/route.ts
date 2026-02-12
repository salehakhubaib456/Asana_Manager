import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess } from "@/lib/permissions";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * GET /api/tasks/[id]/comments - Get all comments for a task
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
      `SELECT c.id, c.task_id, c.user_id, c.content, c.created_at, c.updated_at,
              u.email, u.name, u.avatar_url
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.task_id = ?
       ORDER BY c.created_at ASC`,
      [taskId]
    );

    const comments = rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      user_id: r.user_id,
      content: r.content,
      created_at: r.created_at?.toString(),
      updated_at: r.updated_at?.toString(),
      user: {
        id: r.user_id,
        email: r.email,
        name: r.name,
        avatar_url: r.avatar_url,
      },
    }));

    return NextResponse.json(comments);
  } catch (e) {
    return NextResponse.json({ error: "Failed to get comments", details: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/tasks/[id]/comments - Create a new comment
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
    const { content } = body as { content?: string };
    if (!content?.trim()) {
      return NextResponse.json({ error: "Comment content required" }, { status: 400 });
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
      "INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)",
      [taskId, userId, content.trim()]
    );

    const commentId = result.insertId;
    if (!commentId) return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.task_id, c.user_id, c.content, c.created_at, c.updated_at,
              u.email, u.name, u.avatar_url
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [commentId]
    );

    const comment = rows[0];
    return NextResponse.json({
      id: comment.id,
      task_id: comment.task_id,
      user_id: comment.user_id,
      content: comment.content,
      created_at: comment.created_at?.toString(),
      updated_at: comment.updated_at?.toString(),
      user: {
        id: comment.user_id,
        email: comment.email,
        name: comment.name,
        avatar_url: comment.avatar_url,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create comment", details: String(e) }, { status: 500 });
  }
}
