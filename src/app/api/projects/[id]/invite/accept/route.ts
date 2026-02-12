import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket } from "mysql2";

/**
 * GET /api/projects/[id]/invite/accept?token=XXX
 * Consumes invite token: if user is logged in, adds them to project with permission and marks invite accepted.
 * Returns { success, permission } or { loginRequired: true }.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const projectId = Number((await params).id);
    const token = request.nextUrl.searchParams.get("token");
    if (!projectId || !token) {
      return NextResponse.json({ error: "Missing project or token" }, { status: 400 });
    }

    const [invRows] = await executeQuery<RowDataPacket[]>(
      `SELECT id, project_id, email, permission, invited_by_user_id, expires_at, accepted_at
       FROM project_invitations WHERE token = ? AND accepted_at IS NULL`,
      [token]
    );
    const inv = invRows[0];
    if (!inv) {
      return NextResponse.json({ error: "Invalid or already used invitation" }, { status: 404 });
    }
    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
    }
    if (Number(inv.project_id) !== projectId) {
      return NextResponse.json({ error: "Wrong project" }, { status: 400 });
    }

    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ loginRequired: true, project_id: projectId, invite_token: token });
    }

    const [userRows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, email FROM users WHERE id = ?",
      [userId]
    );
    const user = userRows[0];
    if (!user || user.email?.toLowerCase() !== inv.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email. Please log in with " + inv.email },
        { status: 403 }
      );
    }

    const [existing] = await executeQuery<RowDataPacket[]>(
      "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?",
      [projectId, userId]
    );
    if (existing.length > 0) {
      await executeQuery("UPDATE project_invitations SET accepted_at = NOW() WHERE id = ?", [inv.id]);
      return NextResponse.json({ success: true, already_member: true, permission: inv.permission });
    }

    await executeQuery(
      "INSERT INTO project_members (project_id, user_id, role, permission) VALUES (?, ?, 'member', ?)",
      [projectId, userId, inv.permission]
    );
    await executeQuery("UPDATE project_invitations SET accepted_at = NOW() WHERE id = ?", [inv.id]);

    return NextResponse.json({ success: true, permission: inv.permission });
  } catch (e) {
    console.error("Accept invite error:", e);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
