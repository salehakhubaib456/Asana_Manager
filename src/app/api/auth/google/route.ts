import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createSessionToken, sessionExpiresAt } from "@/lib/auth";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

async function getGoogleUser(access_token: string): Promise<{ email: string; name: string | null; picture: string | null }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) throw new Error("Invalid Google token");
  const data = (await res.json()) as { email?: string; name?: string; picture?: string };
  if (!data.email) throw new Error("Email not provided by Google");
  return {
    email: data.email,
    name: data.name ?? null,
    picture: data.picture ?? null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token } = body as { access_token?: string };
    if (!access_token) return NextResponse.json({ error: "access_token required" }, { status: 400 });

    const { email, name, picture } = await getGoogleUser(access_token);

    let userId: number;
    const [existing] = await pool.query<RowDataPacket[]>("SELECT id, name, avatar_url FROM users WHERE email = ?", [email]);
    if (existing[0]) {
      userId = existing[0].id;
      await pool.query(
        "UPDATE users SET name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url), updated_at = NOW() WHERE id = ?",
        [name, picture, userId]
      );
    } else {
      const [insert] = await pool.query<ResultSetHeader>(
        "INSERT INTO users (email, name, avatar_url, password_hash) VALUES (?, ?, ?, NULL)",
        [email, name, picture]
      );
      userId = insert.insertId;
    }

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
  } catch (e) {
    return NextResponse.json({ error: "Google sign-in failed", details: String(e) }, { status: 500 });
  }
}
