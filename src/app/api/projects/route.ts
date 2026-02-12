import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { runProjectsSpaceMigration } from "@/lib/migrate-projects-space";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

function isUnknownColumn(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("Unknown column") && msg.includes("space_id");
}

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let rows: RowDataPacket[];
    try {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT p.id, p.name, p.description, p.status, p.owner_id, p.folder_id, p.space_id, p.settings, p.is_public, p.share_token, p.workspace_shared, p.created_at, p.updated_at, p.deleted_at
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
         WHERE (p.owner_id = ? OR pm.user_id IS NOT NULL) AND p.deleted_at IS NULL
         ORDER BY p.folder_id IS NULL DESC, p.updated_at DESC`,
        [userId, userId]
      );
    } catch (e) {
      if (isUnknownColumn(e)) {
        const mig = await runProjectsSpaceMigration();
        if (!mig.ok) throw e;
        [rows] = await pool.query<RowDataPacket[]>(
          `SELECT p.id, p.name, p.description, p.status, p.owner_id, p.folder_id, p.space_id, p.settings, p.is_public, p.share_token, p.workspace_shared, p.created_at, p.updated_at, p.deleted_at
           FROM projects p
           LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
           WHERE (p.owner_id = ? OR pm.user_id IS NOT NULL) AND p.deleted_at IS NULL
           ORDER BY p.folder_id IS NULL DESC, p.updated_at DESC`,
          [userId, userId]
        );
      } else {
        throw e;
      }
    }
    const list = rows.map((r) => {
      let settings = null;
      if (r.settings) {
        try {
          settings = typeof r.settings === "string" ? JSON.parse(r.settings) : r.settings;
        } catch {
          settings = r.settings;
        }
      }
      return {
        ...r,
        folder_id: r.folder_id ?? null,
        space_id: r.space_id ?? null,
        settings,
        created_at: r.created_at?.toString(),
        updated_at: r.updated_at?.toString(),
        deleted_at: r.deleted_at?.toString(),
      };
    });
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: "Failed to list projects", details: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, description, status, space_id, folder_id, is_public } = body as {
      name: string;
      description?: string;
      status?: string;
      space_id?: number | null;
      folder_id?: number | null;
      is_public?: boolean;
    };
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    let insertQuery = "INSERT INTO projects (name, description, status, owner_id, space_id, folder_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)";
    let insertParams: unknown[] = [
      name.trim(),
      description?.trim() || null,
      status || "on_track",
      userId,
      space_id ?? null,
      folder_id ?? null,
      is_public === true ? 1 : 0,
    ];

    let result: ResultSetHeader;
    try {
      [result] = await pool.query<ResultSetHeader>(insertQuery, insertParams);
    } catch (e) {
      if (isUnknownColumn(e)) {
        const mig = await runProjectsSpaceMigration();
        if (!mig.ok) throw e;
        [result] = await pool.query<ResultSetHeader>(insertQuery, insertParams);
      } else {
        throw e;
      }
    }
    const id = result.insertId;
    if (!id) return NextResponse.json({ error: "Failed to create project" }, { status: 500 });

    await pool.query("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')", [id, userId]);
    await pool.query(
      "INSERT INTO sections (project_id, name, position) VALUES (?, 'To Do', 1), (?, 'Doing', 2), (?, 'Done', 3)",
      [id, id, id]
    );

    const selectQuery =
      "SELECT id, name, description, status, owner_id, folder_id, space_id, settings, is_public, created_at, updated_at, deleted_at FROM projects WHERE id = ?";
    let rows: RowDataPacket[];
    try {
      [rows] = await pool.query<RowDataPacket[]>(selectQuery, [id]);
    } catch (e) {
      if (isUnknownColumn(e)) {
        await runProjectsSpaceMigration();
        [rows] = await pool.query<RowDataPacket[]>(selectQuery, [id]);
      } else {
        throw e;
      }
    }
    const project = rows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 500 });
    let settings = null;
    if (project.settings) {
      try {
        settings = typeof project.settings === "string" ? JSON.parse(project.settings) : project.settings;
      } catch {
        settings = project.settings;
      }
    }
    return NextResponse.json({
      ...project,
      folder_id: project.folder_id ?? null,
      space_id: project.space_id ?? null,
      settings,
      created_at: project.created_at?.toString(),
      updated_at: project.updated_at?.toString(),
      deleted_at: project.deleted_at?.toString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create project", details: String(e) }, { status: 500 });
  }
}
