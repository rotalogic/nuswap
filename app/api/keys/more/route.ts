import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureDevice, copyDeviceCookie } from "@/lib/device";
import { deepLink } from "@/lib/codes";

export const dynamic = "force-dynamic";

interface CodeRow {
  id: number;
  code: string;
  use_count: number;
}

const CODE_RE = /^NG-[A-Za-z0-9]{8}$/;
const LIMIT = 10;

function publicCode(row: CodeRow) {
  return { code: row.code, deepLink: deepLink(row.code), useCount: row.use_count };
}

// Kode komunitas yang layak tampil untuk perangkat ini: aktif, bukan starter,
// bukan titipan perangkat ini sendiri, dan belum pernah diambil perangkat ini.
const ELIGIBLE = `
  SELECT c.id, c.code, c.use_count
    FROM invitation_codes c
   WHERE c.status = 'active'
     AND c.deleted_at IS NULL
     AND c.is_starter = false
     AND (c.owner_device_id IS NULL OR c.owner_device_id <> $1)
     AND NOT EXISTS (
       SELECT 1 FROM code_takes t WHERE t.code_id = c.id AND t.device_id = $1
     )`;

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const device = await ensureDevice(req, res);

  const rawExclude = req.nextUrl.searchParams.get("exclude") ?? "";
  const exclude = rawExclude
    .split(",")
    .map((s) => s.trim())
    .filter((s) => CODE_RE.test(s))
    .slice(0, 30);

  // Putaran pertama: kode yang sedang tampil dikeluarkan, supaya yang datang
  // benar-benar kode lain dari database.
  let rows = await query<CodeRow>(
    `${ELIGIBLE} AND NOT (c.code = ANY($2::text[]))
     ORDER BY c.use_count ASC, c.created_at ASC
     LIMIT ${LIMIT}`,
    [device.id, exclude]
  );

  // Bila sisa antrean kurang dari 10, lengkapi dari awal antrean (tetap hanya
  // kode yang belum pernah diambil perangkat ini) supaya grid tetap penuh.
  if (rows.length < LIMIT) {
    const picked = rows.map((r) => r.code);
    const fill = await query<CodeRow>(
      `${ELIGIBLE} AND NOT (c.code = ANY($2::text[]))
       ORDER BY c.use_count ASC, c.created_at ASC
       LIMIT ${LIMIT - rows.length}`,
      [device.id, picked]
    );
    rows = [...rows, ...fill];
  }

  const out = NextResponse.json({ grid: rows.map(publicCode) });
  copyDeviceCookie(res, out);
  return out;
}
