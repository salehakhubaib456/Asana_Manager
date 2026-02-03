import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getBearerToken } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [sessions] = await pool.query<RowDataPacket[]>(
      "SELECT user_id FROM user_sessions WHERE session_token = ? AND expires_at > NOW()",
      [token]
    );
    const session = sessions[0];
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE id = ?",
      [session.user_id]
    );
    const row = users[0];
    if (!row) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const user = {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url,
      created_at: row.created_at?.toString(),
      updated_at: row.updated_at?.toString(),
    };
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json({ error: "Failed to get user", details: String(e) }, { status: 500 });
  }
}
