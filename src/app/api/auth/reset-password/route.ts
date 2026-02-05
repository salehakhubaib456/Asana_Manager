import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, newPassword } = body as { email?: string; otp?: string; newPassword?: string };
    if (!email?.trim() || !otp?.trim() || !newPassword) {
      return NextResponse.json({ error: "Email, OTP and new password required" }, { status: 400 });
    }
    const [users] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE email = ?", [email.trim()]);
    const user = users[0];
    if (!user) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM password_resets WHERE user_id = ? AND token = ? AND expires_at > NOW() AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [user.id, otp.trim()]
    );
    const reset = rows[0];
    if (!reset) return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });

    const password_hash = await hashPassword(newPassword);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [password_hash, user.id]);
    await pool.query("UPDATE password_resets SET used_at = NOW() WHERE id = ?", [reset.id]);

    return NextResponse.json({ message: "Password reset successfully." });
  } catch (e) {
    return NextResponse.json({ error: "Failed to reset password", details: String(e) }, { status: 500 });
  }
}
