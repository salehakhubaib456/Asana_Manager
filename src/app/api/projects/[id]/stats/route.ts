import { NextRequest, NextResponse } from "next/server";
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

/**
 * GET /api/projects/[id]/stats - Get project progress and statistics
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

    const hasAccess = await hasProjectAccess(userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get task statistics
    const [taskStats] = await executeQuery<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'on_track' THEN 1 ELSE 0 END) as on_track_tasks,
        SUM(CASE WHEN status = 'still_waiting' THEN 1 ELSE 0 END) as waiting_tasks,
        SUM(CASE WHEN due_date < CURDATE() AND status != 'completed' THEN 1 ELSE 0 END) as overdue_tasks
      FROM tasks
      WHERE project_id = ? AND deleted_at IS NULL`,
      [projectId]
    );

    const stats = taskStats[0];
    const total = Number(stats.total_tasks) || 0;
    const completed = Number(stats.completed_tasks) || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({
      total_tasks: total,
      completed_tasks: completed,
      on_track_tasks: Number(stats.on_track_tasks) || 0,
      waiting_tasks: Number(stats.waiting_tasks) || 0,
      overdue_tasks: Number(stats.overdue_tasks) || 0,
      progress_percentage: progress,
    });
  } catch (e) {
    return handleDbError(e, "Failed to get stats");
  }
}
