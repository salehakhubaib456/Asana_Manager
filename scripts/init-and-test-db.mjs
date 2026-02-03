import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Load .env from project root (run from project root: npm run db:init)
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

const pool = mysql.createPool({
  host,
  port: Number(port),
  user: decodeURIComponent(user),
  password: decodeURIComponent(password),
  database: database.split("?")[0],
  waitForConnections: true,
  connectionLimit: 5,
  ...(needsSsl && { ssl: { rejectUnauthorized: false } }),
});

async function main() {
  try {
    console.log("Connecting to MySQL...");
    await pool.query("SELECT 1");
    console.log("OK: Connection successful.");

    console.log("Creating users table if not exists...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("OK: users table ready.");

    const [rows] = await pool.query("SELECT COUNT(*) as n FROM users");
    console.log("OK: Table check done. Row count:", rows[0].n);

    console.log("\nDatabase connection test passed.");
  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
