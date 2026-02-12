/**
 * Migration: Spaces table + folders.space_id.
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
    console.log("Running spaces migration...\n");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS spaces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        user_id INT NOT NULL,
        default_permission VARCHAR(50) DEFAULT 'full_edit',
        is_private TINYINT(1) DEFAULT 0,
        position INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("✓ spaces table");
    await run("ALTER TABLE folders ADD COLUMN space_id INT NULL", "folders.space_id");
    await run(
      "ALTER TABLE folders ADD CONSTRAINT fk_folders_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL",
      "fk_folders_space"
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
