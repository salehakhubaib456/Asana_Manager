import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess } from "@/lib/permissions";
import { runProjectDocsMigration } from "@/lib/migrate-project-docs";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

function isTableMissing(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("doesn't exist") || msg.includes("Unknown table");
}

/**
 * GET /api/projects/[id]/docs - List docs for a project
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(_request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

    const hasAccess = await hasProjectAccess(userId, projectId);
    if (!hasAccess) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    let rows: RowDataPacket[];
    try {
      [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.project_id, d.title, d.content, d.created_by, d.created_at, d.updated_at,
              u.name as author_name, u.email as author_email
       FROM project_docs d
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.project_id = ?
       ORDER BY d.updated_at DESC`,
        [projectId]
      );
    } catch (e) {
      if (isTableMissing(e)) {
        const mig = await runProjectDocsMigration();
        if (!mig.ok) throw e;
        [rows] = await pool.query<RowDataPacket[]>(
          `SELECT d.id, d.project_id, d.title, d.content, d.created_by, d.created_at, d.updated_at,
                  u.name as author_name, u.email as author_email
           FROM project_docs d
           LEFT JOIN users u ON u.id = d.created_by
           WHERE d.project_id = ?
           ORDER BY d.updated_at DESC`,
          [projectId]
        );
      } else {
        throw e;
      }
    }

    const docs = rows.map((r) => ({
      id: r.id,
      project_id: r.project_id,
      title: r.title || "Untitled",
      content: r.content ?? "",
      created_by: r.created_by,
      created_at: r.created_at?.toString(),
      updated_at: r.updated_at?.toString(),
      author_name: r.author_name ?? null,
      author_email: r.author_email ?? null,
    }));

    return NextResponse.json(docs);
  } catch (e) {
    return NextResponse.json({ error: "Failed to list docs", details: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/docs - Create a doc (title default Untitled)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

    const hasAccess = await hasProjectAccess(userId, projectId);
    if (!hasAccess) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const title = (body.title as string)?.trim() || "Untitled";

    let result: ResultSetHeader;
    try {
      [result] = await pool.query<ResultSetHeader>(
        "INSERT INTO project_docs (project_id, title, content, created_by) VALUES (?, ?, ?, ?)",
        [projectId, title, "", userId]
      );
    } catch (e) {
      if (isTableMissing(e)) {
        const mig = await runProjectDocsMigration();
        if (!mig.ok) throw e;
        [result] = await pool.query<ResultSetHeader>(
          "INSERT INTO project_docs (project_id, title, content, created_by) VALUES (?, ?, ?, ?)",
          [projectId, title, "", userId]
        );
      } else {
        throw e;
      }
    }
    const id = result.insertId;
    if (!id) return NextResponse.json({ error: "Failed to create doc" }, { status: 500 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.project_id, d.title, d.content, d.created_by, d.created_at, d.updated_at,
              u.name as author_name, u.email as author_email
       FROM project_docs d
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.id = ?`,
      [id]
    );
    const r = rows[0];
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
    return NextResponse.json({ error: "Failed to create doc", details: String(e) }, { status: 500 });
  }
}
