import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword, createSessionToken, sessionExpiresAt } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body as { email: string; password: string; name?: string };
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 });
    }
    const password_hash = await hashPassword(password);
    const [insertResult] = await pool.query<RowDataPacket>(
      "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
      [email.trim(), name?.trim() || null, password_hash]
    );
    const userId = (insertResult as { insertId?: number }).insertId;
    if (!userId) return NextResponse.json({ error: "Failed to create user" }, { status: 500 });

    const session_token = createSessionToken();
    const expires_at = sessionExpiresAt();
    await pool.query(
      "INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)",
      [userId, session_token, expires_at]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE id = ?",
      [userId]
    );
    const user = rows[0];
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 500 });

    return NextResponse.json({
      user: { ...user, created_at: user.created_at?.toString(), updated_at: user.updated_at?.toString() },
      token: session_token,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Duplicate") || msg.includes("UNIQUE")) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }
    return NextResponse.json({ error: "Signup failed", details: msg }, { status: 500 });
  }
}
