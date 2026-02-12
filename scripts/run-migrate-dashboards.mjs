/**
 * Migration: Create dashboards and dashboard_members tables.
 * Safe to run multiple times (CREATE TABLE IF NOT EXISTS). Uses retry on "Too many connections".
 */

import { createConnectionWithRetry } from "./lib-migrate-db.mjs";

const connection = await createConnectionWithRetry(5, 3000);

const schemaPath = join(process.cwd(), "database", "migration_dashboards.sql");
const sql = readFileSync(schemaPath, "utf8");

try {
  console.log("Running dashboards migration...\n");
  await connection.query(sql);
  console.log("✓ dashboards table");
  console.log("✓ dashboard_members table");
  console.log("\n✓ Migration completed successfully!");
} catch (err) {
  console.error("\n✗ Migration failed:", err.message);
  process.exit(1);
} finally {
  await connection.end();
}
