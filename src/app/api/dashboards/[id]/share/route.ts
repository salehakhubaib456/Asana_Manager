import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import crypto from "crypto";

async function handleDbError(error: unknown, defaultMessage: string) {
  if (error instanceof Error) {
    if (error.message.includes("Too many connections")) {
      return NextResponse.json(
        { error: "Database connection limit reached. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: defaultMessage, details: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ error: defaultMessage }, { status: 500 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dashboardId = Number((await params).id);
    if (!dashboardId) return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });

    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, is_public, share_token, workspace_shared, owner_id FROM dashboards WHERE id = ?",
      [dashboardId]
    );
    const dashboard = rows[0];
    if (!dashboard) return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });

    const isOwner = dashboard.owner_id === userId;
    if (!isOwner) {
      const [memberRows] = await executeQuery<RowDataPacket[]>(
        "SELECT user_id FROM dashboard_members WHERE dashboard_id = ? AND user_id = ?",
        [dashboardId, userId]
      );
      if (memberRows.length === 0) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const [memberRows] = await executeQuery<RowDataPacket[]>(
      `SELECT dm.user_id, dm.role, u.email, u.name, u.avatar_url
       FROM dashboard_members dm
       LEFT JOIN users u ON u.id = dm.user_id
       WHERE dm.dashboard_id = ?`,
      [dashboardId]
    );
    const members = memberRows.map((row) => ({
      user_id: row.user_id,
      role: row.role,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url,
    }));

    const shareLink = dashboard.share_token
      ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/dashboard/${dashboard.share_token}`
      : null;

    return NextResponse.json({
      dashboard_id: dashboard.id,
      dashboard_name: dashboard.name,
      is_public: Boolean(dashboard.is_public),
      workspace_shared: Boolean(dashboard.workspace_shared),
      share_token: dashboard.share_token,
      share_link: shareLink,
      members,
      can_manage: isOwner,
    });
  } catch (e) {
    return handleDbError(e, "Failed to get sharing info");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dashboardId = Number((await params).id);
    if (!dashboardId) return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });

    const [ownerRows] = await executeQuery<RowDataPacket[]>("SELECT owner_id FROM dashboards WHERE id = ?", [
      dashboardId,
    ]);
    if (!ownerRows[0] || ownerRows[0].owner_id !== userId) {
      return NextResponse.json({ error: "Only owner can invite" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body as { email?: string; role?: "admin" | "member" };
    if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const [userRows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, email, name FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );
    if (userRows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const targetUser = userRows[0];

    const [existing] = await executeQuery<RowDataPacket[]>(
      "SELECT id FROM dashboard_members WHERE dashboard_id = ? AND user_id = ?",
      [dashboardId, targetUser.id]
    );
    if (existing.length > 0) return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    if (ownerRows[0].owner_id === targetUser.id) {
      return NextResponse.json({ error: "User is already the owner" }, { status: 400 });
    }

    await executeQuery(
      "INSERT INTO dashboard_members (dashboard_id, user_id, role) VALUES (?, ?, ?)",
      [dashboardId, targetUser.id, role || "member"]
    );
    return NextResponse.json({
      message: "User invited successfully",
      user: { id: targetUser.id, email: targetUser.email, name: targetUser.name },
    });
  } catch (e) {
    return handleDbError(e, "Failed to invite user");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dashboardId = Number((await params).id);
    if (!dashboardId) return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });

    const [ownerRows] = await executeQuery<RowDataPacket[]>("SELECT owner_id FROM dashboards WHERE id = ?", [
      dashboardId,
    ]);
    if (!ownerRows[0] || ownerRows[0].owner_id !== userId) {
      return NextResponse.json({ error: "Only owner can change sharing settings" }, { status: 403 });
    }

    const body = await request.json();
    const { is_public, workspace_shared, generate_token } = body as {
      is_public?: boolean;
      workspace_shared?: boolean;
      generate_token?: boolean;
    };
    const updates: string[] = [];
    const values: unknown[] = [];
    if (is_public !== undefined) {
      updates.push("is_public = ?");
      values.push(is_public);
    }
    if (workspace_shared !== undefined) {
      updates.push("workspace_shared = ?");
      values.push(workspace_shared);
    }
    if (generate_token) {
      const token = crypto.randomBytes(32).toString("hex");
      updates.push("share_token = ?");
      values.push(token);
    }
    if (updates.length === 0) return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    values.push(dashboardId);
    await executeQuery(`UPDATE dashboards SET ${updates.join(", ")} WHERE id = ?`, values);

    const [rows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, is_public, share_token, workspace_shared FROM dashboards WHERE id = ?",
      [dashboardId]
    );
    const dashboard = rows[0];
    const shareLink = dashboard.share_token
      ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/dashboard/${dashboard.share_token}`
      : null;
    return NextResponse.json({
      dashboard_id: dashboard.id,
      is_public: Boolean(dashboard.is_public),
      workspace_shared: Boolean(dashboard.workspace_shared),
      share_token: dashboard.share_token,
      share_link: shareLink,
    });
  } catch (e) {
    return handleDbError(e, "Failed to update sharing settings");
  }
}
