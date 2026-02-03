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
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, description, status, owner_id, settings, created_at, updated_at, deleted_at FROM projects WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    const project = rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({
      ...project,
      created_at: project.created_at?.toString(),
      updated_at: project.updated_at?.toString(),
      deleted_at: project.deleted_at?.toString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to get project", details: String(e) }, { status: 500 });
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
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name); }
    if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description); }
    if (body.status !== undefined) { updates.push("status = ?"); values.push(body.status); }
    if (updates.length === 0) return NextResponse.json({ error: "No updates" }, { status: 400 });
    values.push(id);
    await pool.query(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`, values);

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, description, status, owner_id, settings, created_at, updated_at, deleted_at FROM projects WHERE id = ?",
      [id]
    );
    const project = rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({
      ...project,
      created_at: project.created_at?.toString(),
      updated_at: project.updated_at?.toString(),
      deleted_at: project.deleted_at?.toString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update project", details: String(e) }, { status: 500 });
  }
}
