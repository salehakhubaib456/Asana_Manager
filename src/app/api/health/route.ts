import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({
      status: "ok",
      database: "connected",
      app: "asanamanager",
    });
  } catch (e) {
    return NextResponse.json(
      { status: "error", database: "disconnected", error: String(e) },
      { status: 503 }
    );
  }
}
