import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword, createSessionToken, sessionExpiresAt } from "@/lib/auth";
import { runAuthMigration, isSchemaError } from "@/lib/migrate-auth";
import type { RowDataPacket } from "mysql2";

async function doLogin(email: string, password: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, email, name, avatar_url, password_hash, created_at, updated_at FROM users WHERE email = ?",
    [email.trim()]
  );
  const row = rows[0];
  if (!row?.password_hash) {
    return NextResponse.json({ error: "Invalid email or password", emailRegistered: false }, { status: 401 });
  }
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return NextResponse.json({ error: "Invalid email or password", emailRegistered: true }, { status: 401 });

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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    try {
      return await doLogin(email, password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isSchemaError(msg)) {
        const migration = await runAuthMigration();
        if (migration.ok) {
          try {
            return await doLogin(email, password);
          } catch (retryErr: unknown) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            return NextResponse.json(
              { error: "Login failed after migration", details: retryMsg },
              { status: 500 }
            );
          }
        }
        return NextResponse.json(
          { error: "Database schema outdated. Migration failed.", details: migration.error ?? msg },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: "Login failed", details: msg }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Login failed", details: msg }, { status: 500 });
  }
}
