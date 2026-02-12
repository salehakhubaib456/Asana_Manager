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

export async function runProjectsSpaceMigration(): Promise<{ ok: boolean; error?: string; log?: string[] }> {
  const log: string[] = [];
  try {
    try {
      await pool.query("ALTER TABLE projects ADD COLUMN space_id INT NULL");
      log.push("✓ projects.space_id");
    } catch (err) {
      if (!isSkipError(err)) throw err;
      log.push("⊘ projects.space_id (already exists)");
    }

    try {
      await pool.query(
        "ALTER TABLE projects ADD CONSTRAINT fk_projects_space FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL"
      );
      log.push("✓ fk_projects_space");
    } catch (err) {
      if (!isSkipError(err)) throw err;
      log.push("⊘ fk_projects_space (already exists)");
    }

    return { ok: true, log };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, log };
  }
}
