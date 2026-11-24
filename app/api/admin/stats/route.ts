import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!readSession(req)) {
    return NextResponse.json({ error: "Belum login sebagai admin." }, { status: 401 });
  }
  const stats = await queryOne(
    `SELECT
       (SELECT COUNT(*)::int FROM invitation_codes WHERE status = 'active' AND deleted_at IS NULL) AS codes_active,
       (SELECT COUNT(*)::int FROM invitation_codes WHERE status = 'retired') AS codes_retired,
       (SELECT COUNT(*)::int FROM invitation_codes) AS codes_total,
       (SELECT COUNT(*)::int FROM code_takes) AS takes_total,
       (SELECT COUNT(*)::int FROM code_reports WHERE result = 'success') AS reports_success,
       (SELECT COUNT(*)::int FROM code_reports WHERE result = 'failed') AS reports_failed,
       (SELECT COUNT(*)::int FROM devices) AS devices_total,
       (SELECT COUNT(*)::int FROM winners) AS winners_total`
  );
  return NextResponse.json({ stats });
}
