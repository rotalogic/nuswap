import { NextRequest, NextResponse } from "next/server";
import { queryOne, transaction } from "@/lib/db";
import { ensureDevice, withDeviceCookie } from "@/lib/device";
import { extractCode, deepLink } from "@/lib/codes";
import { QUEUE_KEY } from "@/lib/queue";
import { rateLimited } from "@/lib/ratelimit";
import { ipHash } from "@/lib/request";

export const dynamic = "force-dynamic";

// Cukup untuk satu keluarga yang berbagi HP, tanpa membiarkan satu perangkat
// membanjiri antrean.
const MAX_ACTIVE_PER_DEVICE = 5;

function duplicate() {
  return NextResponse.json({ error: "Kode ini sudah ada di antrean Nuswap." }, { status: 409 });
}

export async function POST(req: NextRequest) {
  if (await rateLimited(`submit:${ipHash(req)}`, 30, 60 * 60)) {
    return NextResponse.json(
      { error: "Terlalu banyak titipan dari jaringan ini. Coba lagi nanti." },
      { status: 429 }
    );
  }

  let body: { input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const code = extractCode(body?.input);
  if (!code) {
    return NextResponse.json(
      { error: "Format tidak dikenali. Tempel kode NG-xxxxxxxx atau tautan Nusuk lengkap." },
      { status: 400 }
    );
  }

  const existing = await queryOne("SELECT id FROM invitation_codes WHERE code = $1", [code]);
  if (existing) return duplicate();

  const device = await ensureDevice(req);
  const result = await transaction(async (client) => {
    // Kunci baris perangkat, supaya titipan bersamaan tidak melewati batas.
    await client.query("SELECT id FROM devices WHERE id = $1 FOR UPDATE", [device.id]);
    const active = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM invitation_codes
        WHERE owner_device_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [device.id]
    );
    if (active.rows[0].n >= MAX_ACTIVE_PER_DEVICE) return { kind: "limit" as const };

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO invitation_codes (code, owner_device_id) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING RETURNING id`,
      [code, device.id]
    );
    if (inserted.rows.length === 0) return { kind: "duplicate" as const };

    // Posisi menurut urutan tampil yang sama dengan antrean.
    const rank = await client.query<{ position: number }>(
      `SELECT ranked.position FROM (
         SELECT c.id, (ROW_NUMBER() OVER (ORDER BY ${QUEUE_KEY}))::int AS position
           FROM invitation_codes c
          WHERE c.status = 'active' AND c.deleted_at IS NULL AND c.is_starter = false
       ) ranked WHERE ranked.id = $1`,
      [inserted.rows[0].id]
    );
    return { kind: "ok" as const, position: rank.rows[0].position };
  });

  let out: NextResponse;
  if (result.kind === "ok") {
    out = NextResponse.json({ ok: true, code, deepLink: deepLink(code), position: result.position });
  } else if (result.kind === "duplicate") {
    out = duplicate();
  } else {
    out = NextResponse.json(
      { error: `Satu perangkat bisa menitip paling banyak ${MAX_ACTIVE_PER_DEVICE} kunci aktif.` },
      { status: 429 }
    );
  }
  return withDeviceCookie(req, out, device);
}
