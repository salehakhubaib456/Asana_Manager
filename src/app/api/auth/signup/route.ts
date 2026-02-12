import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword, createSessionToken, sessionExpiresAt } from "@/lib/auth";
import { runAuthMigration, isSchemaError } from "@/lib/migrate-auth";
import { validatePassword } from "@/lib/password";
import { isValidEmail, INVALID_EMAIL_MESSAGE } from "@/lib/email";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

type SignupBody = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  name?: string;
};

async function doSignup(body: SignupBody) {
  const { email, password, firstName, lastName, name } = body;
  const fullName =
    [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ") ||
    name?.trim() ||
    null;
  const password_hash = await hashPassword(password);
  const [insertResult] = await pool.query<ResultSetHeader>(
    "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
    [email.trim(), fullName, password_hash]
  );
  const userId = insertResult.insertId;
  if (!userId) throw new Error("Failed to create user");

  const session_token = createSessionToken();
  const expires_at = sessionExpiresAt();
  await pool.query(
    "INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)",
    [userId, session_token, expires_at]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, email, name, avatar_url, created_at, updated_at, onboarding_completed_at, workspace_name, onboarding_use_case, onboarding_manage_types FROM users WHERE id = ?",
    [userId]
  );
  const row = rows[0];
  if (!row) throw new Error("User not found");

  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url,
      created_at: row.created_at?.toString(),
      updated_at: row.updated_at?.toString(),
      onboarding_completed_at: row.onboarding_completed_at?.toString() ?? null,
      workspace_name: row.workspace_name ?? null,
      onboarding_use_case: row.onboarding_use_case ?? null,
      onboarding_manage_types: row.onboarding_manage_types ?? null,
    },
    token: session_token,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignupBody;
    const { email, password } = body;
    const trimmedEmail = email?.trim();
    if (!trimmedEmail || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }
    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json(
        { error: INVALID_EMAIL_MESSAGE },
        { status: 400 }
      );
    }

    const pwdValidation = validatePassword(password);
    if (!pwdValidation.valid) {
      return NextResponse.json(
        { error: pwdValidation.error ?? "Invalid password" },
        { status: 400 }
      );
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ?",
      [trimmedEmail]
    );
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    const bodyWithEmail = { ...body, email: trimmedEmail };

    try {
      const result = await doSignup(bodyWithEmail);
      return NextResponse.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Duplicate") || msg.includes("UNIQUE")) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 400 }
        );
      }
      if (isSchemaError(msg)) {
        const migration = await runAuthMigration();
        if (migration.ok) {
          try {
            const result = await doSignup(bodyWithEmail);
            return NextResponse.json(result);
          } catch (retryErr: unknown) {
            const retryMsg =
              retryErr instanceof Error ? retryErr.message : String(retryErr);
            if (retryMsg.includes("Duplicate") || retryMsg.includes("UNIQUE")) {
              return NextResponse.json(
                { error: "Email already registered" },
                { status: 400 }
              );
            }
            return NextResponse.json(
              { error: "Signup failed after migration", details: retryMsg },
              { status: 500 }
            );
          }
        }
        return NextResponse.json(
          {
            error: "Database schema outdated. Migration failed.",
            details: migration.error ?? msg,
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Signup failed", details: msg },
        { status: 500 }
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Signup failed", details: msg },
      { status: 500 }
    );
  }
}
