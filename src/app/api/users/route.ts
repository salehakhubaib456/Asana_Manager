import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, createdAt, updatedAt FROM users ORDER BY createdAt DESC"
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
    const [result] = await pool.query<RowDataPacket>(
      "INSERT INTO users (email, name) VALUES (?, ?)",
      [email.trim(), name?.trim() || null]
    );
    const insertId = (result as { insertId?: number })?.insertId;
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, createdAt, updatedAt FROM users WHERE id = ?",
      [insertId]
    );
    return NextResponse.json(rows[0] ?? { id: insertId, email: email.trim(), name: name?.trim() ?? null });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to create user", details: String(e) },
      { status: 500 }
    );
  }
}
