import { NextRequest, NextResponse } from "next/server";
import { pool, executeQuery } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * POST /api/auth/onboarding-complete
 * Called when user finishes onboarding. Creates default project (workspace), updates user, optionally invites emails.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      workspaceName,
      useCase,
      manageTypes,
      invitedEmails,
    } = body as {
      workspaceName?: string;
      useCase?: string;
      manageTypes?: string[];
      invitedEmails?: string[];
    };

    const name = (workspaceName || "").trim() || "My Workspace";
    const useCaseVal = (useCase || "").trim() || null;
    const manageTypesStr = Array.isArray(manageTypes) && manageTypes.length > 0
      ? manageTypes.join(", ")
      : null;

    // Create default project (workspace)
    const [insertResult] = await pool.query<ResultSetHeader>(
      "INSERT INTO projects (name, description, status, owner_id) VALUES (?, ?, ?, ?)",
      [name, `Workspace: ${name}`, "on_track", userId]
    );
    const projectId = insertResult.insertId;
    if (!projectId) return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });

    await pool.query("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')", [projectId, userId]);
    await pool.query(
      "INSERT INTO sections (project_id, name, position) VALUES (?, 'To Do', 1), (?, 'Doing', 2), (?, 'Done', 3)",
      [projectId, projectId, projectId]
    );

    // Update user onboarding fields
    await executeQuery(
      `UPDATE users SET onboarding_completed_at = NOW(), workspace_name = ?, onboarding_use_case = ?, onboarding_manage_types = ? WHERE id = ?`,
      [name, useCaseVal, manageTypesStr, userId]
    );

    // Invite emails to the new project (only existing users can be added)
    const emails = Array.isArray(invitedEmails) ? invitedEmails.filter((e) => typeof e === "string" && e.trim()) : [];
    for (const email of emails) {
      const emailTrim = email.trim().toLowerCase();
      if (!emailTrim) continue;
      try {
        const [userRows] = await executeQuery<RowDataPacket[]>(
          "SELECT id FROM users WHERE email = ?",
          [emailTrim]
        );
        if (userRows.length === 0) continue; // User not found, skip
        const targetId = userRows[0].id;
        if (targetId === userId) continue; // Don't add self
        const [existing] = await executeQuery<RowDataPacket[]>(
          "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?",
          [projectId, targetId]
        );
        if (existing.length > 0) continue;
        await executeQuery(
          "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')",
          [projectId, targetId]
        );
      } catch {
        // Skip failed invite
      }
    }

    return NextResponse.json({
      ok: true,
      projectId,
      workspaceName: name,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to complete onboarding", details: String(e) },
      { status: 500 }
    );
  }
}
