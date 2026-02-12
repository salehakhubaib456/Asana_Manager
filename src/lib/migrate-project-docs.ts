import { pool } from "@/lib/db";

function isSkipError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("already exists") || msg.includes("Duplicate");
}

export async function runProjectDocsMigration(): Promise<{ ok: boolean; error?: string; log?: string[] }> {
  const log: string[] = [];
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_docs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        title VARCHAR(500) NOT NULL DEFAULT 'Untitled',
        content LONGTEXT NULL,
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    log.push("✓ project_docs table");
    try {
      await pool.query("CREATE INDEX idx_project_docs_project ON project_docs(project_id)");
      log.push("✓ idx_project_docs_project");
    } catch (err) {
      if (!isSkipError(err)) throw err;
      log.push("⊘ index (already exists)");
    }
    return { ok: true, log };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, log };
  }
}
