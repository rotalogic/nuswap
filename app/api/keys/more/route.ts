import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { findDevice } from "@/lib/device";
import { CODE_REGEX } from "@/lib/codes";
import { ELIGIBLE_CODES, QUEUE_KEY, publicCode, type QueueRow } from "@/lib/queue";

export const dynamic = "force-dynamic";

const LIMIT = 10;

export async function GET(req: NextRequest) {
  const device = await findDevice(req);
  const deviceId = device?.id ?? 0;

  const rawExclude = req.nextUrl.searchParams.get("exclude") ?? "";
  const exclude = rawExclude
    .split(",")
    .map((s) => s.trim())
    .filter((s) => CODE_REGEX.test(s))
    .slice(0, 30);

  // Putaran pertama: kode yang sedang tampil dikeluarkan, supaya yang datang
  // benar-benar kode lain dari database.
  let rows = await query<QueueRow>(
    `${ELIGIBLE_CODES} AND NOT (c.code = ANY($2::text[]))
     ORDER BY ${QUEUE_KEY}
     LIMIT ${LIMIT}`,
    [deviceId, exclude]
  );

  // Bila sisa antrean kurang dari 10, lengkapi dari awal antrean (tetap hanya
  // kode yang belum pernah diambil perangkat ini) supaya grid tetap penuh.
  if (rows.length < LIMIT) {
    const picked = rows.map((r) => r.code);
    const fill = await query<QueueRow>(
      `${ELIGIBLE_CODES} AND NOT (c.code = ANY($2::text[]))
       ORDER BY ${QUEUE_KEY}
       LIMIT ${LIMIT - rows.length}`,
      [deviceId, picked]
    );
    rows = [...rows, ...fill];
  }

  return NextResponse.json({ grid: rows.map(publicCode) });
}
