import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, user_id, space_id, position, created_at, updated_at FROM folders WHERE user_id = ? ORDER BY position ASC, id ASC",
      [userId]
    );
    const list = rows.map((r) => ({
      ...r,
      space_id: r.space_id ?? null,
      created_at: r.created_at?.toString(),
      updated_at: r.updated_at?.toString(),
    }));
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: "Failed to list folders", details: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, space_id } = body as { name?: string; space_id?: number | null };
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    const [maxPos] = await pool.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM folders WHERE user_id = ?",
      [userId]
    );
    const position = (maxPos[0]?.pos ?? 1) as number;
    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO folders (name, user_id, space_id, position) VALUES (?, ?, ?, ?)",
      [name.trim(), userId, space_id ?? null, position]
    );
    const id = result.insertId;
    if (!id) return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, user_id, space_id, position, created_at, updated_at FROM folders WHERE id = ?",
      [id]
    );
    const folder = rows[0];
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 500 });
    return NextResponse.json({
      ...folder,
      created_at: folder.created_at?.toString(),
      updated_at: folder.updated_at?.toString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create folder", details: String(e) }, { status: 500 });
  }
}
