/**
 * Migration: project_invitations table + project_members.permission for email invite flow.
 * Safe to run multiple times (CREATE TABLE IF NOT EXISTS, skip ALTER if column exists).
 */

import { createConnectionWithRetry } from "./lib-migrate-db.mjs";

const connection = await createConnectionWithRetry(5, 3000);

async function run(sql, label) {
  try {
    await connection.query(sql);
    console.log(`✓ ${label}`);
    return true;
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_DUP_KEYNAME" || err.code === "ER_TABLE_EXISTS_ERROR") {
      console.log(`⊘ ${label} (already exists, skipping)`);
      return true;
    }
    console.error(`✗ ${label}:`, err.message);
    return false;
  }
}

async function tableExists(name) {
  const [rows] = await connection.query(
    "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [name]
  );
  return rows.length > 0;
}

async function columnExists(table, column) {
  const [rows] = await connection.query(
    "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  try {
    console.log("Running project invitations migration...\n");

    if (!(await tableExists("project_invitations"))) {
      await run(
        `CREATE TABLE project_invitations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          task_id INT NULL,
          email VARCHAR(255) NOT NULL,
          permission ENUM('view', 'comment', 'edit', 'full_edit') NOT NULL DEFAULT 'full_edit',
          token VARCHAR(64) NOT NULL,
          invited_by_user_id INT NOT NULL,
          expires_at DATETIME NOT NULL,
          accepted_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_invite_token (token),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        "Created project_invitations table"
      );
      await run(
        "CREATE INDEX idx_project_invitations_token ON project_invitations(token)",
        "Created idx_project_invitations_token"
      );
      await run(
        "CREATE INDEX idx_project_invitations_email_project ON project_invitations(email, project_id)",
        "Created idx_project_invitations_email_project"
      );
    } else {
      console.log("⊘ project_invitations table (already exists, skipping)");
    }

    if (!(await columnExists("project_members", "permission"))) {
      await run(
        "ALTER TABLE project_members ADD COLUMN permission ENUM('view', 'comment', 'edit', 'full_edit') NULL DEFAULT NULL",
        "Added project_members.permission"
      );
    } else {
      console.log("⊘ project_members.permission (already exists, skipping)");
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
