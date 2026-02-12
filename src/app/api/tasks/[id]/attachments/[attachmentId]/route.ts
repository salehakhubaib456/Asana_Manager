import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess } from "@/lib/permissions";
import type { RowDataPacket } from "mysql2";

/**
 * DELETE /api/tasks/[id]/attachments/[attachmentId] - Delete an attachment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const taskId = Number((await params).id);
    const attachmentId = Number((await params).attachmentId);
    if (!taskId || !attachmentId) {
      return NextResponse.json({ error: "Invalid task or attachment id" }, { status: 400 });
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

    // Check if attachment exists and belongs to task
    const [attachRows] = await pool.query<RowDataPacket[]>(
      "SELECT user_id FROM attachments WHERE id = ? AND task_id = ?",
      [attachmentId, taskId]
    );
    const attachment = attachRows[0];
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Only allow deletion by the uploader or project admin/owner
    // For simplicity, allow deletion by uploader only for now
    if (attachment.user_id !== userId) {
      return NextResponse.json({ error: "You can only delete your own attachments" }, { status: 403 });
    }

    await pool.query("DELETE FROM attachments WHERE id = ?", [attachmentId]);

    return NextResponse.json({ message: "Attachment deleted" });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete attachment", details: String(e) }, { status: 500 });
  }
}
