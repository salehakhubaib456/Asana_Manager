import { NextRequest, NextResponse } from "next/server";
import { runSpacesMigration } from "@/lib/migrate-spaces";

export async function GET(request: NextRequest) {
  const dev = process.env.NODE_ENV === "development";
  const key = request.nextUrl.searchParams.get("key");
  const secret = process.env.MIGRATE_SECRET_KEY;
  if (!dev && !(secret && key === secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runSpacesMigration();
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      log: result.log || ["Spaces migration finished."],
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
