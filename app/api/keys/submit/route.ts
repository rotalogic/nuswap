import { NextRequest, NextResponse } from "next/server";
import { getPool, queryOne } from "@/lib/db";
import { ensureDevice, copyDeviceCookie } from "@/lib/device";
import { extractCode, deepLink } from "@/lib/codes";
import { rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
  }
  const jar = NextResponse.json({ ok: true });
  const device = await ensureDevice(req, jar);

  let body: { input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const code = extractCode(body.input);
  if (!code) {
    return NextResponse.json(
      { error: "Format tidak dikenali. Tempel kode NG-xxxxxxxx atau tautan Nusuk lengkap." },
      { status: 400 }
    );
  }

  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM invitation_codes WHERE code = $1",
    [code]
  );
  if (existing) {
    return NextResponse.json(
      { error: "Kode ini sudah ada di antrean Nuswap." },
      { status: 409 }
    );
  }

  let inserted: { id: number } | null;
  try {
    inserted = await queryOne<{ id: number }>(
      "INSERT INTO invitation_codes (code, owner_device_id) VALUES ($1, $2) RETURNING id",
      [code, device.id]
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "Kode ini sudah ada di antrean Nuswap." },
        { status: 409 }
      );
    }
    throw err;
  }

  // Posisi antrean: peringkat di antara kode aktif menurut urutan tampil
  // (paling sedikit dipakai dulu, lalu yang lebih dulu dititipkan).
  const rank = await queryOne<{ position: number }>(
    `SELECT COUNT(*)::int + 1 AS position
       FROM invitation_codes
      WHERE status = 'active' AND deleted_at IS NULL AND is_starter = false
        AND (use_count, created_at) < (
          SELECT use_count, created_at FROM invitation_codes WHERE id = $1
        )`,
    [inserted!.id]
  );

  const out = NextResponse.json({
    ok: true,
    code,
    deepLink: deepLink(code),
    position: rank?.position ?? 1,
  });
  copyDeviceCookie(jar, out);
  return out;
}
