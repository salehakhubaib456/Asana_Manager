/**
 * Shared DB connection for migration scripts.
 * Loads .env and creates a single connection with retry on "Too many connections".
 */

import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DEFAULT_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export function loadEnv() {
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
}

function getConnectionConfig() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/);
    if (!match) {
      console.error("ERROR: Invalid DATABASE_URL format");
      process.exit(1);
    }
    const [, user, password, host, port, database] = match;
    const needsSsl = url.includes("ssl-mode=REQUIRED") || url.includes("aivencloud.com");
    return {
      host,
      port: Number(port),
      user: decodeURIComponent(user),
      password: decodeURIComponent(password),
      database: database.split("?")[0],
      multipleStatements: true,
      ...(needsSsl && { ssl: { rejectUnauthorized: false } }),
    };
  }
  return {
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "asanamanager",
    multipleStatements: true,
  };
}

/**
 * Create a single connection with retry on ER_CON_COUNT_ERROR (Too many connections).
 * Always call connection.end() when done.
 */
export async function createConnectionWithRetry(retries = DEFAULT_RETRIES, delayMs = RETRY_DELAY_MS) {
  loadEnv();
  const config = getConnectionConfig();
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mysql.createConnection(config);
      return conn;
    } catch (err) {
      lastErr = err;
      const isTooMany = err.code === "ER_CON_COUNT_ERROR" || (err.message && err.message.includes("Too many connections"));
      if (isTooMany && attempt < retries) {
        console.warn(`Too many connections (attempt ${attempt}/${retries}). Waiting ${delayMs}ms before retry...`);
        if (attempt === 1) {
          console.warn("Tip: Stop the dev server (Ctrl+C) and run this migration again, or increase MySQL max_connections.");
        }
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
