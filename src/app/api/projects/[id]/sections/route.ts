import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket } from "mysql2";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [rows] = await pool.query<RowDataPacket[]>(
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

    const body = await request.json();
    const { name, position } = body as { name: string; position?: number };
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    const pos = position ?? 0;
    const [result] = await pool.query<RowDataPacket>(
      "INSERT INTO sections (project_id, name, position) VALUES (?, ?, ?)",
      [projectId, name.trim(), pos]
    );
    const id = (result as { insertId?: number }).insertId;
    if (!id) return NextResponse.json({ error: "Failed to create section" }, { status: 500 });

    const [rows] = await pool.query<RowDataPacket[]>(
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
    return NextResponse.json({ error: "Failed to create section", details: String(e) }, { status: 500 });
  }
}
