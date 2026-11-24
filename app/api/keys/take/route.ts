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
  const res = NextResponse.json({ ok: true });
  const device = await ensureDevice(req, res);

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  if (!CODE_REGEX.test(code)) {
    return NextResponse.json({ error: "Format kode tidak valid." }, { status: 400 });
  }

  const row = await queryOne<{ id: number; status: string }>(
    "SELECT id, status FROM invitation_codes WHERE code = $1 AND deleted_at IS NULL",
    [code]
  );
  if (!row) {
    return NextResponse.json({ error: "Kode tidak ditemukan." }, { status: 404 });
  }
  if (row.status !== "active") {
    return NextResponse.json({ error: "Kode ini sudah tidak aktif." }, { status: 410 });
  }

  try {
    await getPool().query(
      "INSERT INTO code_takes (device_id, code_id) VALUES ($1, $2)",
      [device.id, row.id]
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "Kode ini sudah pernah kamu ambil di perangkat ini." },
        { status: 409 }
      );
    }
    throw err;
  }
  await getPool().query(
    "UPDATE invitation_codes SET use_count = use_count + 1 WHERE id = $1",
    [row.id]
  );

  const out = NextResponse.json({ ok: true, code });
  copyDeviceCookie(res, out);
  return out;
}
