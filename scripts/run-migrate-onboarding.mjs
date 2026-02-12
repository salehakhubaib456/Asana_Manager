/**
 * Migration: Add onboarding columns to users table.
 * Safe to run multiple times (skips if column exists). Uses retry on "Too many connections".
 */

import { createConnectionWithRetry } from "./lib-migrate-db.mjs";

const connection = await createConnectionWithRetry(5, 3000);

async function addColumn(name, def) {
  try {
    await connection.query(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
    console.log(`✓ ${name}`);
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log(`⊘ ${name} (already exists)`);
    } else {
      throw err;
    }
  }
}

try {
  console.log("Running onboarding migration...\n");
  await addColumn("onboarding_completed_at", "DATETIME NULL");
  await addColumn("workspace_name", "VARCHAR(255) NULL");
  await addColumn("onboarding_use_case", "VARCHAR(50) NULL");
  await addColumn("onboarding_manage_types", "VARCHAR(500) NULL");
  console.log("\n✓ Migration completed successfully!");
} catch (err) {
  console.error("\n✗ Migration failed:", err.message);
  process.exit(1);
} finally {
  await connection.end();
}
