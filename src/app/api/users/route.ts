import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, avatar_url, created_at, updated_at FROM users ORDER BY created_at DESC"
    );
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch users", details: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body as { email: string; name?: string };
    if (!email?.trim()) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }
    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO users (email, name) VALUES (?, ?)",
      [email.trim(), name?.trim() ?? null]
    );
    const insertId = result.insertId;
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE id = ?",
      [insertId]
    );
    const u = rows[0];
    return NextResponse.json(u ? { ...u, created_at: u.created_at?.toString(), updated_at: u.updated_at?.toString() } : { id: insertId, email: email.trim(), name: name?.trim() ?? null });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to create user", details: String(e) },
      { status: 500 }
    );
  }
}
