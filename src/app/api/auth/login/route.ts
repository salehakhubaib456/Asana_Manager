import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword, createSessionToken, sessionExpiresAt } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, avatar_url, password_hash, created_at, updated_at FROM users WHERE email = ?",
      [email.trim()]
    );
    const row = rows[0];
    if (!row?.password_hash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    const session_token = createSessionToken();
    const expires_at = sessionExpiresAt();
    await pool.query(
      "INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)",
      [row.id, session_token, expires_at]
    );

    const user = {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url,
      created_at: row.created_at?.toString(),
      updated_at: row.updated_at?.toString(),
    };
    return NextResponse.json({ user, token: session_token });
  } catch (e) {
    return NextResponse.json({ error: "Login failed", details: String(e) }, { status: 500 });
  }
}
