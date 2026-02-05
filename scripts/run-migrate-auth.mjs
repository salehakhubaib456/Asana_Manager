/**
 * Migration: add password_hash & avatar_url to users, ensure user_sessions exists.
 * Run if signup fails with "Unknown column 'password_hash'" or "user_sessions doesn't exist".
 * Safe to run multiple times (ignores "Duplicate column" / "Duplicate key").
 */

import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error("ERROR: .env not found at", envPath);
  process.exit(1);
}
const raw = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) {
    const key = m[1].trim().replace(/^\uFEFF/, "");
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[key] = val;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: DATABASE_URL not set in .env");
  process.exit(1);
}

const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/);
if (!match) {
  console.error("ERROR: Invalid DATABASE_URL format");
  process.exit(1);
}

const [, user, password, host, port, database] = match;
const needsSsl = url.includes("ssl-mode=REQUIRED") || url.includes("aivencloud.com");

const connection = await mysql.createConnection({
  host,
  port: Number(port),
  user: decodeURIComponent(user),
  password: decodeURIComponent(password),
  database: database.split("?")[0],
  multipleStatements: true,
  ...(needsSsl && { ssl: { rejectUnauthorized: false } }),
});

async function run(sql, label) {
  try {
    await connection.query(sql);
    console.log("OK:", label);
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("Duplicate column") || msg.includes("Duplicate key") || msg.includes("already exists")) {
      console.log("Skip (already applied):", label);
    } else {
      console.error("ERROR:", label, msg);
      throw err;
    }
  }
}

try {
  console.log("Running auth migration...");
  await run(
    "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL COMMENT 'bcrypt';",
    "users.password_hash"
  );
  await run(
    "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL;",
    "users.avatar_url"
  );
  await run(
    "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;",
    "users.created_at"
  );
  await run(
    "ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;",
    "users.updated_at"
  );
  await run(
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      session_token VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    "user_sessions table"
  );
  await run(
    "CREATE UNIQUE INDEX idx_user_sessions_token ON user_sessions(session_token);",
    "idx_user_sessions_token"
  );
  await run(
    "CREATE INDEX idx_user_sessions_user_expires ON user_sessions(user_id, expires_at);",
    "idx_user_sessions_user_expires"
  );
  console.log("Auth migration finished. Try signup again.");
} catch (err) {
  process.exit(1);
} finally {
  await connection.end();
}
