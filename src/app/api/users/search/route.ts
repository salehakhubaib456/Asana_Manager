import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket } from "mysql2";

/**
 * GET /api/users/search?q=email - Search users by email (for adding to projects)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, avatar_url FROM users WHERE email LIKE ? LIMIT 10",
      [`%${q}%`]
    );

    const users = rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      avatar_url: r.avatar_url,
    }));

    return NextResponse.json(users);
  } catch (e) {
    return NextResponse.json({ error: "Failed to search users", details: String(e) }, { status: 500 });
  }
}
