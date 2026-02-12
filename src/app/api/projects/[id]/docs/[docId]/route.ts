import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess } from "@/lib/permissions";
import type { RowDataPacket } from "mysql2";

/**
 * GET /api/projects/[id]/docs/[docId] - Get one doc
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const userId = await getCurrentUserId(_request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    const docId = Number((await params).docId);
    if (!projectId || !docId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const hasAccess = await hasProjectAccess(userId, projectId);
    if (!hasAccess) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.project_id, d.title, d.content, d.created_by, d.created_at, d.updated_at,
              u.name as author_name, u.email as author_email
       FROM project_docs d
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.id = ? AND d.project_id = ?`,
      [docId, projectId]
    );
    const r = rows[0];
    if (!r) return NextResponse.json({ error: "Doc not found" }, { status: 404 });

    return NextResponse.json({
      id: r.id,
      project_id: r.project_id,
      title: r.title || "Untitled",
      content: r.content ?? "",
      created_by: r.created_by,
      created_at: r.created_at?.toString(),
      updated_at: r.updated_at?.toString(),
      author_name: r.author_name ?? null,
      author_email: r.author_email ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to get doc", details: String(e) }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/docs/[docId] - Update doc title and/or content
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    const docId = Number((await params).docId);
    if (!projectId || !docId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const hasAccess = await hasProjectAccess(userId, projectId);
    if (!hasAccess) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const title = (body.title as string)?.trim();
    const content = body.content;

    if (title !== undefined || content !== undefined) {
      if (title !== undefined) {
        await pool.query("UPDATE project_docs SET title = ? WHERE id = ? AND project_id = ?", [
          title || "Untitled",
          docId,
          projectId,
        ]);
      }
      if (content !== undefined) {
        await pool.query("UPDATE project_docs SET content = ? WHERE id = ? AND project_id = ?", [
          typeof content === "string" ? content : "",
          docId,
          projectId,
        ]);
      }
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.project_id, d.title, d.content, d.created_by, d.created_at, d.updated_at,
              u.name as author_name, u.email as author_email
       FROM project_docs d
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.id = ? AND d.project_id = ?`,
      [docId, projectId]
    );
    const r = rows[0];
    if (!r) return NextResponse.json({ error: "Doc not found" }, { status: 404 });

    return NextResponse.json({
      id: r.id,
      project_id: r.project_id,
      title: r.title || "Untitled",
      content: r.content ?? "",
      created_by: r.created_by,
      created_at: r.created_at?.toString(),
      updated_at: r.updated_at?.toString(),
      author_name: r.author_name ?? null,
      author_email: r.author_email ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update doc", details: String(e) }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/docs/[docId] - Delete a doc
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const userId = await getCurrentUserId(_request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    const docId = Number((await params).docId);
    if (!projectId || !docId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const hasAccess = await hasProjectAccess(userId, projectId);
    if (!hasAccess) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const [result] = await pool.query("DELETE FROM project_docs WHERE id = ? AND project_id = ?", [docId, projectId]);
    const ok = (result as { affectedRows?: number }).affectedRows === 1;
    if (!ok) return NextResponse.json({ error: "Doc not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete doc", details: String(e) }, { status: 500 });
  }
}
