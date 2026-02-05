import { pool } from "@/lib/db";

const steps = [
  "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL COMMENT 'bcrypt'",
  "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL",
  "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  `CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  "CREATE UNIQUE INDEX idx_user_sessions_token ON user_sessions(session_token)",
  "CREATE INDEX idx_user_sessions_user_expires ON user_sessions(user_id, expires_at)",
];

function isSkipError(msg: string): boolean {
  return (
    msg.includes("Duplicate column") ||
    msg.includes("Duplicate key") ||
    msg.includes("already exists")
  );
}

export async function runAuthMigration(): Promise<{ ok: boolean; error?: string }> {
  try {
    for (const sql of steps) {
      try {
        await pool.query(sql);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isSkipError(msg)) return { ok: false, error: msg };
      }
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export function isSchemaError(msg: string): boolean {
  return (
    msg.includes("password_hash") ||
    msg.includes("user_sessions") ||
    msg.includes("Unknown column") ||
    msg.includes("doesn't exist") ||
    msg.includes("avatar_url") ||
    msg.includes("created_at") ||
    msg.includes("updated_at")
  );
}
