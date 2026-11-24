import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ensureDevice, withDeviceCookie } from "@/lib/device";
import { CODE_REGEX } from "@/lib/codes";
import { rateLimited } from "@/lib/ratelimit";
import { ipHash } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (await rateLimited(`take:${ipHash(req)}`, 60, 60)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const code = typeof body?.code === "string" ? body.code : "";
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

  const device = await ensureDevice(req);
  // Satu pernyataan, supaya use_count tidak pernah beda dari jumlah pengambilan.
  const taken = await queryOne<{ id: number }>(
    `WITH new_take AS (
       INSERT INTO code_takes (device_id, code_id) VALUES ($1, $2)
       ON CONFLICT (device_id, code_id) DO NOTHING
       RETURNING code_id
     )
     UPDATE invitation_codes SET use_count = use_count + 1
      WHERE id IN (SELECT code_id FROM new_take)
     RETURNING id`,
    [device.id, row.id]
  );

  const out = taken
    ? NextResponse.json({ ok: true, code })
    : NextResponse.json(
        { error: "Kode ini sudah pernah kamu ambil di perangkat ini." },
        { status: 409 }
      );
  return withDeviceCookie<NextResponse>(req, out, device);
}
