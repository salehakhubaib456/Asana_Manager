import { NextRequest, NextResponse } from "next/server";
import { runProjectsSpaceMigration } from "@/lib/migrate-projects-space";

export async function GET(request: NextRequest) {
  const dev = process.env.NODE_ENV === "development";
  const key = request.nextUrl.searchParams.get("key");
  const secret = process.env.MIGRATE_SECRET_KEY;
  if (!dev && !(secret && key === secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runProjectsSpaceMigration();
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      log: result.log || ["Projects space_id migration finished."],
    });
  }
  return NextResponse.json(
    { ok: false, error: result.error, log: result.log || [result.error] },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  return GET(request);
}
