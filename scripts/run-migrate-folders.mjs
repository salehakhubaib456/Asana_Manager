/**
 * Migration: Folders table + project.folder_id for sidebar Spaces.
 * Safe to run multiple times. Uses retry on "Too many connections".
 */

import { createConnectionWithRetry } from "./lib-migrate-db.mjs";

const connection = await createConnectionWithRetry(5, 3000);

async function run(sql, label) {
  try {
    await connection.query(sql);
    console.log(`✓ ${label}`);
    return true;
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_DUP_KEYNAME" || err.code === "ER_FK_DUP_NAME") {
      console.log(`⊘ ${label} (already exists, skipping)`);
      return true;
    }
    console.error(`✗ ${label}:`, err.message);
    return false;
  }
}

async function main() {
  try {
    console.log("Running folders migration...\n");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        user_id INT NOT NULL,
        position INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("✓ folders table");
    await run("ALTER TABLE projects ADD COLUMN folder_id INT NULL", "projects.folder_id");
    await run(
      "ALTER TABLE projects ADD CONSTRAINT fk_projects_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL",
      "fk_projects_folder"
    );
    console.log("\n✓ Migration completed successfully!");
  } catch (err) {
    console.error("\n✗ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
