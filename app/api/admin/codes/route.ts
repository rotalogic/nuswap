import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!readSession(req)) {
    return NextResponse.json({ error: "Belum login sebagai admin." }, { status: 401 });
  }
  const codes = await query(
    `SELECT id, code, is_starter, status, fail_count, use_count,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
            deleted_at IS NOT NULL AS deleted
       FROM invitation_codes
      ORDER BY created_at DESC`
  );
  return NextResponse.json({ codes });
}
