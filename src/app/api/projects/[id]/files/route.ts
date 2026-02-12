import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { hasProjectAccess } from "@/lib/permissions";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * GET /api/projects/[id]/files - List files (resources) for a project
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(_request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

    const hasAccess = await hasProjectAccess(userId, projectId);
    if (!hasAccess) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pf.id, pf.project_id, pf.task_id, pf.uploaded_by, pf.file_name, pf.file_url, pf.file_type, pf.created_at,
              u.name as uploader_name, u.email as uploader_email
       FROM project_files pf
       LEFT JOIN users u ON u.id = pf.uploaded_by
       WHERE pf.project_id = ?
       ORDER BY pf.created_at DESC`,
      [projectId]
    );

    const files = rows.map((r) => ({
      id: r.id,
      project_id: r.project_id,
      task_id: r.task_id ?? null,
      uploaded_by: r.uploaded_by,
      file_name: r.file_name,
      file_url: r.file_url,
      file_type: r.file_type ?? null,
      created_at: r.created_at?.toString(),
      uploader_name: r.uploader_name ?? null,
      uploader_email: r.uploader_email ?? null,
    }));

    return NextResponse.json(files);
  } catch (e) {
    return NextResponse.json({ error: "Failed to list files", details: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/files - Upload a file (multipart/form-data)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const projectId = Number((await params).id);
    if (!projectId) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

    const hasAccess = await hasProjectAccess(userId, projectId);
    if (!hasAccess) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = path.extname(safeName) || "";
    const baseName = path.basename(safeName, ext);
    const uniqueName = `${baseName}-${randomUUID().slice(0, 8)}${ext}`;

    const uploadsDir = path.join(process.cwd(), "public", "uploads", String(projectId));
    await mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, uniqueName);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${projectId}/${uniqueName}`;
    const fileType = file.type || null;
    const fileSize = file.size;

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO project_files (project_id, task_id, uploaded_by, file_name, file_url, file_type) VALUES (?, NULL, ?, ?, ?, ?)",
      [projectId, userId, file.name, fileUrl, fileType]
    );
    const id = result.insertId;
    if (!id) return NextResponse.json({ error: "Failed to save file record" }, { status: 500 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pf.id, pf.project_id, pf.task_id, pf.uploaded_by, pf.file_name, pf.file_url, pf.file_type, pf.created_at,
              u.name as uploader_name, u.email as uploader_email
       FROM project_files pf
       LEFT JOIN users u ON u.id = pf.uploaded_by
       WHERE pf.id = ?`,
      [id]
    );
    const row = rows[0];
    return NextResponse.json({
      id: row.id,
      project_id: row.project_id,
      task_id: row.task_id ?? null,
      uploaded_by: row.uploaded_by,
      file_name: row.file_name,
      file_url: row.file_url,
      file_type: row.file_type ?? null,
      file_size: fileSize,
      created_at: row.created_at?.toString(),
      uploader_name: row.uploader_name ?? null,
      uploader_email: row.uploader_email ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to upload file", details: String(e) }, { status: 500 });
  }
}
