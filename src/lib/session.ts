import { pool } from "@/lib/db";
import { getBearerToken } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";

/** Returns current user id if valid session token, else null. */
export async function getCurrentUserId(request: Request): Promise<number | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT user_id FROM user_sessions WHERE session_token = ? AND expires_at > NOW()",
    [token]
  );
  return rows[0]?.user_id ?? null;
}
