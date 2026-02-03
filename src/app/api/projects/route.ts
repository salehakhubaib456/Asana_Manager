import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket } from "mysql2";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.name, p.description, p.status, p.owner_id, p.settings, p.created_at, p.updated_at, p.deleted_at
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
       WHERE (p.owner_id = ? OR pm.user_id IS NOT NULL) AND p.deleted_at IS NULL
       ORDER BY p.updated_at DESC`,
      [userId, userId]
    );
    const list = rows.map((r) => ({
      ...r,
      created_at: r.created_at?.toString(),
      updated_at: r.updated_at?.toString(),
      deleted_at: r.deleted_at?.toString(),
    }));
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: "Failed to list projects", details: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, description, status } = body as { name: string; description?: string; status?: string };
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    const [result] = await pool.query<RowDataPacket>(
      "INSERT INTO projects (name, description, status, owner_id) VALUES (?, ?, ?, ?)",
      [name.trim(), description?.trim() || null, status || "on_track", userId]
    );
    const id = (result as { insertId?: number }).insertId;
    if (!id) return NextResponse.json({ error: "Failed to create project" }, { status: 500 });

    await pool.query("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')", [id, userId]);
    await pool.query(
      "INSERT INTO sections (project_id, name, position) VALUES (?, 'To Do', 1), (?, 'Doing', 2), (?, 'Done', 3)",
      [id, id, id]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, description, status, owner_id, settings, created_at, updated_at, deleted_at FROM projects WHERE id = ?",
      [id]
    );
    const project = rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 500 });
    return NextResponse.json({
      ...project,
      created_at: project.created_at?.toString(),
      updated_at: project.updated_at?.toString(),
      deleted_at: project.deleted_at?.toString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create project", details: String(e) }, { status: 500 });
  }
}
