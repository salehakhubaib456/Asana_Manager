import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, description, user_id, default_permission, is_private, position, created_at, updated_at FROM spaces WHERE user_id = ? ORDER BY position ASC, id ASC",
      [userId]
    );
    const list = rows.map((r) => ({
      ...r,
      is_private: Boolean(r.is_private),
      created_at: r.created_at?.toString(),
      updated_at: r.updated_at?.toString(),
    }));
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: "Failed to list spaces", details: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, description, default_permission, is_private } = body as {
      name?: string;
      description?: string;
      default_permission?: string;
      is_private?: boolean;
    };
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    const [maxPos] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM spaces WHERE user_id = ?", [userId]);
    const position = (maxPos[0]?.pos ?? 1) as number;

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO spaces (name, description, user_id, default_permission, is_private, position) VALUES (?, ?, ?, ?, ?, ?)",
      [name.trim(), (description ?? "").trim() || null, userId, default_permission || "full_edit", is_private ? 1 : 0, position]
    );
    const id = result.insertId;
    if (!id) return NextResponse.json({ error: "Failed to create space" }, { status: 500 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, description, user_id, default_permission, is_private, position, created_at, updated_at FROM spaces WHERE id = ?",
      [id]
    );
    const space = rows[0];
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 500 });
    return NextResponse.json({
      ...space,
      is_private: Boolean(space.is_private),
      created_at: space.created_at?.toString(),
      updated_at: space.updated_at?.toString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create space", details: String(e) }, { status: 500 });
  }
}
