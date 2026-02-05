import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

const OTP_EXPIRE_MINUTES = 10;

function generateOTP(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Asanamanager <onboarding@resend.dev>",
      to: email,
      subject: "Your OTP for Asanamanager – password reset",
      html: `<p>Your 4-digit OTP for Asanamanager password reset is: <strong>${otp}</strong></p><p>Valid for ${OTP_EXPIRE_MINUTES} minutes. Do not share this code.</p>`,
    });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const [users] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE email = ?", [email.trim()]);
    const user = users[0];
    if (!user) {
      return NextResponse.json({ message: "If this email exists, we sent an OTP." });
    }
    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRE_MINUTES);
    await pool.query(
      "INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, otp, expiresAt]
    );
    const sent = await sendOTPEmail(email.trim(), otp);
    if (!sent) {
      return NextResponse.json(
        { error: "Email service is not configured. Set RESEND_API_KEY to send OTP to your inbox." },
        { status: 503 }
      );
    }
    return NextResponse.json({ message: "OTP sent to your email. Check your inbox (e.g. Gmail) and paste it below." });
  } catch (e) {
    return NextResponse.json({ error: "Failed to send OTP", details: String(e) }, { status: 500 });
  }
}
