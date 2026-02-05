import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body as { email?: string; otp?: string };
    if (!email?.trim() || !otp?.trim()) {
      return NextResponse.json({ error: "Email and OTP required" }, { status: 400 });
    }
    const [users] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE email = ?", [email.trim()]);
    const user = users[0];
    if (!user) return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM password_resets WHERE user_id = ? AND token = ? AND expires_at > NOW() AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [user.id, otp.trim()]
    );
    const reset = rows[0];
    if (!reset) return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Verification failed", details: String(e) }, { status: 500 });
  }
}
