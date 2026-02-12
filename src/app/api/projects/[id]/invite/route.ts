import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { canManageMembers } from "@/lib/permissions";
import { isValidEmail, INVALID_EMAIL_MESSAGE } from "@/lib/email";
import crypto from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const INVITE_EXPIRE_DAYS = 7;
export type InvitePermission = "view" | "comment" | "edit" | "full_edit";

/**
 * POST /api/projects/[id]/invite – send invitation email with permission.
 * Body: { email: string, permission?: InvitePermission, task_id?: number }
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

    const canManage = await canManageMembers(userId, projectId);
    if (!canManage) {
      return NextResponse.json({ error: "Only owners and admins can invite" }, { status: 403 });
    }

    const body = await request.json();
    const email = (body?.email as string)?.trim()?.toLowerCase();
    const permission = (body?.permission as InvitePermission) || "full_edit";
    const taskId = body?.task_id != null ? Number(body.task_id) : null;

    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: INVALID_EMAIL_MESSAGE }, { status: 400 });
    }
    if (!["view", "comment", "edit", "full_edit"].includes(permission)) {
      return NextResponse.json({ error: "Invalid permission" }, { status: 400 });
    }

    const [projectRows] = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, owner_id FROM projects WHERE id = ? AND deleted_at IS NULL",
      [projectId]
    );
    const project = projectRows[0];
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const [inviterRows] = await executeQuery<RowDataPacket[]>(
      "SELECT name, email FROM users WHERE id = ?",
      [userId]
    );
    const inviterName = inviterRows[0]?.name || inviterRows[0]?.email || "Someone";

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRE_DAYS);

    await executeQuery(
      `INSERT INTO project_invitations (project_id, task_id, email, permission, token, invited_by_user_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, taskId, email, permission, token, userId, expiresAt]
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const acceptUrl = `${appUrl}/dashboard/projects/${projectId}?invite=${token}`;

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const { data, error } = await resend.emails.send({
          from: process.env.RESEND_FROM ?? "Asanamanager <onboarding@resend.dev>",
          to: email,
          subject: `You're invited to "${project.name}" on Asanamanager`,
          html: `
            <p>${inviterName} invited you to the project <strong>${project.name}</strong>.</p>
            <p>Your permission: <strong>${permission.replace("_", " ")}</strong>.</p>
            <p><a href="${acceptUrl}" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:white;text-decoration:none;border-radius:6px;">Open project</a></p>
            <p>This link expires in ${INVITE_EXPIRE_DAYS} days. If you don't have an account, you'll be asked to sign up first.</p>
          `,
        });
        if (error) {
          console.error("Invite email Resend error:", error);
          const msg =
            error.message?.includes("domain") || error.message?.includes("verified")
              ? "Email not sent: verify your sending domain in Resend dashboard (Domains). With onboarding@resend.dev you can only send to the test email you added in Resend."
              : error.message || "Email service rejected the request.";
          return NextResponse.json(
            { error: msg },
            { status: 503 }
          );
        }
      } catch (e) {
        console.error("Invite email send failed:", e);
        return NextResponse.json(
          { error: "Invitation created but email could not be sent. Check RESEND_API_KEY and Resend dashboard." },
          { status: 503 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Email not configured. Set RESEND_API_KEY to send invitations." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      message: "Invitation sent to " + email,
      accept_url: acceptUrl,
    });
  } catch (e) {
    console.error("Invite error:", e);
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
}
