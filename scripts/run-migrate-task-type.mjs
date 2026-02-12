/**
 * Migration: Add task, milestone, form_response, meeting_note to tasks.task_type ENUM.
 * Uses DATABASE_URL from .env. Safe to run once.
 */

import { createConnectionWithRetry } from "./lib-migrate-db.mjs";
import { readFileSync } from "fs";
import { join } from "path";

const connection = await createConnectionWithRetry(5, 3000);

const raw = readFileSync(
  join(process.cwd(), "database", "migration_task_type_add_task_milestone.sql"),
  "utf8"
);
const sql = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .trim();

async function main() {
  try {
    console.log("Running task_type migration (add Task, Milestone, Form Response, Meeting Note)...\n");
    await connection.query(sql);
    console.log("✓ tasks.task_type ENUM updated.");
    console.log("\n✓ Migration completed successfully!");
  } catch (err) {
    console.error("\n✗ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
