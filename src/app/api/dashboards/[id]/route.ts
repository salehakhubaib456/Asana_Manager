import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket } from "mysql2";

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

async function hasDashboardAccess(userId: number, dashboardId: number): Promise<boolean> {
  const [rows] = await executeQuery<RowDataPacket[]>(
    "SELECT 1 FROM dashboards d LEFT JOIN dashboard_members dm ON dm.dashboard_id = d.id AND dm.user_id = ? WHERE d.id = ? AND (d.owner_id = ? OR dm.user_id IS NOT NULL)",
    [userId, dashboardId, userId]
  );
  return rows.length > 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, description, owner_id, settings, is_public, share_token, workspace_shared, last_viewed_at, created_at, updated_at FROM dashboards WHERE id = ?",
      [id]
    );
    const dashboard = rows[0];
    if (!dashboard) return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    const access = await hasDashboardAccess(userId, id);
    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Update last_viewed_at
    await executeQuery("UPDATE dashboards SET last_viewed_at = NOW() WHERE id = ?", [id]);

    return NextResponse.json(toDashboard({ ...dashboard, last_viewed_at: new Date() }));
  } catch (e) {
    return NextResponse.json({ error: "Failed to get dashboard", details: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [ownerRows] = await executeQuery<RowDataPacket[]>("SELECT owner_id FROM dashboards WHERE id = ?", [id]);
    if (!ownerRows[0] || ownerRows[0].owner_id !== userId) {
      return NextResponse.json({ error: "Only owner can update dashboard" }, { status: 403 });
    }

    const body = await request.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.name !== undefined) {
      updates.push("name = ?");
      values.push(String(body.name).trim());
    }
    if (body.description !== undefined) {
      updates.push("description = ?");
      values.push(body.description === null || body.description === "" ? null : String(body.description).trim());
    }
    if (updates.length === 0) return NextResponse.json({ error: "No updates" }, { status: 400 });
    values.push(id);
    await executeQuery(`UPDATE dashboards SET ${updates.join(", ")} WHERE id = ?`, values);

    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, description, owner_id, settings, is_public, share_token, workspace_shared, last_viewed_at, created_at, updated_at FROM dashboards WHERE id = ?",
      [id]
    );
    return NextResponse.json(toDashboard(rows[0]));
  } catch (e) {
    return NextResponse.json({ error: "Failed to update dashboard", details: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [ownerRows] = await executeQuery<RowDataPacket[]>("SELECT owner_id FROM dashboards WHERE id = ?", [id]);
    if (!ownerRows[0] || ownerRows[0].owner_id !== userId) {
      return NextResponse.json({ error: "Only owner can delete dashboard" }, { status: 403 });
    }
    await executeQuery("DELETE FROM dashboards WHERE id = ?", [id]);
    return NextResponse.json({ message: "Deleted" });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete dashboard", details: String(e) }, { status: 500 });
  }
}
