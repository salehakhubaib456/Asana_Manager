/**
 * Run database/schema_pm.sql against the database (DATABASE_URL in .env).
 * Use once to create/update all PM + auth tables. Safe to re-run for
 * CREATE TABLE IF NOT EXISTS; re-running may report "Duplicate key" for indexes.
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

const schemaPath = join(process.cwd(), "database", "schema_pm.sql");
if (!existsSync(schemaPath)) {
  console.error("ERROR: database/schema_pm.sql not found");
  process.exit(1);
}

const sql = readFileSync(schemaPath, "utf8");

try {
  console.log("Running database/schema_pm.sql...");
  await connection.query(sql);
  console.log("OK: Schema applied. Database updated.");
} catch (err) {
  if (err.message && err.message.includes("Duplicate key")) {
    console.warn("Some indexes already exist (safe to ignore):", err.message);
  } else {
    console.error("ERROR:", err.message);
    process.exit(1);
  }
} finally {
  await connection.end();
}
