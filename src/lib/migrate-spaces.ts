import { pool } from "@/lib/db";

function isSkipError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
  return (
    code === "ER_DUP_FIELDNAME" ||
    code === "ER_DUP_KEYNAME" ||
    code === "ER_FK_DUP_NAME" ||
    msg.includes("Duplicate column") ||
    msg.includes("Duplicate key") ||
    msg.includes("already exists")
  );
}

export async function runSpacesMigration(): Promise<{ ok: boolean; error?: string; log?: string[] }> {
  const log: string[] = [];
  try {
    await pool.query(`
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
    log.push("✓ spaces table");

    try {
      await pool.query("ALTER TABLE folders ADD COLUMN space_id INT NULL");
      log.push("✓ folders.space_id");
    } catch (err) {
      if (!isSkipError(err)) throw err;
      log.push("⊘ folders.space_id (already exists)");
    }

    try {
      await pool.query(
        "ALTER TABLE folders ADD CONSTRAINT fk_folders_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL"
      );
      log.push("✓ fk_folders_space");
    } catch (err) {
      if (!isSkipError(err)) throw err;
      log.push("⊘ fk_folders_space (already exists)");
    }

    return { ok: true, log };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, log };
  }
}
