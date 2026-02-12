/**
 * Migration: Add sharing fields to projects table (is_public, share_token, workspace_shared).
 * Safe to run multiple times (will skip if columns already exist). Uses retry on "Too many connections".
 */

import { createConnectionWithRetry } from "./lib-migrate-db.mjs";

const connection = await createConnectionWithRetry(5, 3000);

async function run(sql, label) {
  try {
    await connection.query(sql);
    console.log(`✓ ${label}`);
    return true;
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_DUP_KEYNAME") {
      console.log(`⊘ ${label} (already exists, skipping)`);
      return true;
    }
    console.error(`✗ ${label}:`, err.message);
    return false;
  }
}

async function checkColumnExists(columnName) {
  try {
    const [rows] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'projects' 
       AND COLUMN_NAME = ?`,
      [columnName]
    );
    return rows.length > 0;
  } catch (err) {
    return false;
  }
}

async function checkIndexExists(indexName) {
  try {
    const [rows] = await connection.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'projects' 
       AND INDEX_NAME = ?`,
      [indexName]
    );
    return rows.length > 0;
  } catch (err) {
    return false;
  }
}

async function main() {
  try {
    console.log("Running sharing migration...\n");

    // Check if columns exist
    const hasIsPublic = await checkColumnExists("is_public");
    const hasShareToken = await checkColumnExists("share_token");
    const hasWorkspaceShared = await checkColumnExists("workspace_shared");
    const hasIndex = await checkIndexExists("idx_projects_share_token");

    if (hasIsPublic && hasShareToken && hasWorkspaceShared && hasIndex) {
      console.log("All sharing columns and index already exist. Migration not needed.");
      await connection.end();
      process.exit(0);
    }

    // Add columns if they don't exist
    if (!hasIsPublic) {
      await run(
        "ALTER TABLE projects ADD COLUMN is_public BOOLEAN DEFAULT FALSE",
        "Added is_public column"
      );
    } else {
      console.log("⊘ is_public column (already exists, skipping)");
    }

    if (!hasShareToken) {
      await run(
        "ALTER TABLE projects ADD COLUMN share_token VARCHAR(64) NULL UNIQUE",
        "Added share_token column"
      );
    } else {
      console.log("⊘ share_token column (already exists, skipping)");
    }

    if (!hasWorkspaceShared) {
      await run(
        "ALTER TABLE projects ADD COLUMN workspace_shared BOOLEAN DEFAULT FALSE",
        "Added workspace_shared column"
      );
    } else {
      console.log("⊘ workspace_shared column (already exists, skipping)");
    }

    // Add index if it doesn't exist
    if (!hasIndex) {
      await run(
        "CREATE INDEX idx_projects_share_token ON projects(share_token)",
        "Created idx_projects_share_token index"
      );
    } else {
      console.log("⊘ idx_projects_share_token index (already exists, skipping)");
    }

    console.log("\n✓ Migration completed successfully!");
  } catch (err) {
    console.error("\n✗ Migration failed:", err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
