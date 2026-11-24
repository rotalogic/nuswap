import { NextRequest, NextResponse } from "next/server";
import { getPool, queryOne } from "@/lib/db";
import { ensureDevice, copyDeviceCookie } from "@/lib/device";
import { CODE_REGEX } from "@/lib/codes";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
  }
  const jar = NextResponse.json({ ok: true });
  const device = await ensureDevice(req, jar);

  let body: { code?: unknown; result?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  const result = body.result;
  if (!CODE_REGEX.test(code)) {
    return NextResponse.json({ error: "Format kode tidak valid." }, { status: 400 });
  }
  if (result !== "success" && result !== "failed") {
    return NextResponse.json({ error: "Hasil laporan harus 'success' atau 'failed'." }, { status: 400 });
  }

  const row = await queryOne<{ id: number; fail_count: number; status: string }>(
    "SELECT id, fail_count, status FROM invitation_codes WHERE code = $1 AND deleted_at IS NULL",
    [code]
  );
  if (!row) {
    return NextResponse.json({ error: "Kode tidak ditemukan." }, { status: 404 });
  }

  await getPool().query(
    "INSERT INTO code_reports (device_id, code_id, result) VALUES ($1, $2, $3)",
    [device.id, row.id, result]
  );

  let failCount = row.fail_count;
  let status = row.status;
  if (result === "failed") {
    failCount = row.fail_count + 1;
    status = failCount >= 3 ? "retired" : row.status;
    await getPool().query(
      "UPDATE invitation_codes SET fail_count = $1, status = $2 WHERE id = $3",
      [failCount, status, row.id]
    );
  }

  const out = NextResponse.json({ ok: true, code, failCount, status });
  copyDeviceCookie(jar, out);
  return out;
}
