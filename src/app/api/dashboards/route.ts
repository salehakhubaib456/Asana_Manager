import { NextRequest, NextResponse } from "next/server";
import { pool, executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

function toDashboard(r: RowDataPacket) {
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
    settings,
    created_at: r.created_at?.toString(),
    updated_at: r.updated_at?.toString(),
    last_viewed_at: r.last_viewed_at?.toString() ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [rows] = await executeQuery<RowDataPacket[]>(
      `SELECT d.id, d.name, d.description, d.owner_id, d.settings, d.is_public, d.share_token, d.workspace_shared, d.last_viewed_at, d.created_at, d.updated_at
       FROM dashboards d
       LEFT JOIN dashboard_members dm ON dm.dashboard_id = d.id AND dm.user_id = ?
       WHERE d.owner_id = ? OR dm.user_id IS NOT NULL
       ORDER BY COALESCE(d.last_viewed_at, d.updated_at) DESC`,
      [userId, userId]
    );
    return NextResponse.json(rows.map(toDashboard));
  } catch (e) {
    return NextResponse.json({ error: "Failed to list dashboards", details: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const name = (body?.name as string)?.trim() || "Dashboard";
    const description = (body?.description as string)?.trim() || null;

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO dashboards (name, description, owner_id) VALUES (?, ?, ?)",
      [name, description, userId]
    );
    const id = result.insertId;
    if (!id) return NextResponse.json({ error: "Failed to create dashboard" }, { status: 500 });

    await pool.query("INSERT INTO dashboard_members (dashboard_id, user_id, role) VALUES (?, ?, 'owner')", [
      id,
      userId,
    ]);

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, description, owner_id, settings, is_public, share_token, workspace_shared, last_viewed_at, created_at, updated_at FROM dashboards WHERE id = ?",
      [id]
    );
    const dashboard = rows[0];
    if (!dashboard) return NextResponse.json({ error: "Dashboard not found" }, { status: 500 });
    return NextResponse.json(toDashboard(dashboard));
  } catch (e) {
    return NextResponse.json({ error: "Failed to create dashboard", details: String(e) }, { status: 500 });
  }
}
