import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getBearerToken } from "@/lib/auth";

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (token) {
    await pool.query("DELETE FROM user_sessions WHERE session_token = ?", [token]);
  }
  return NextResponse.json({ ok: true });
}
