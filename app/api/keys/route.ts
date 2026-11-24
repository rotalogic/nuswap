import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { ensureDevice, copyDeviceCookie } from "@/lib/device";
import { deepLink } from "@/lib/codes";

export const dynamic = "force-dynamic";

interface CodeRow {
  id: number;
  code: string;
  is_starter: boolean;
  use_count: number;
}

function publicCode(row: CodeRow) {
  return { code: row.code, deepLink: deepLink(row.code), useCount: row.use_count };
}

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const device = await ensureDevice(req, res);

  const takeCount = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM code_takes WHERE device_id = $1",
    [device.id]
  );
  const isNewDevice = (takeCount?.n ?? 0) === 0;

  let starter = null;
  let main: ReturnType<typeof publicCode> | null = null;
  if (isNewDevice) {
    const row = await queryOne<CodeRow>(
      "SELECT id, code, is_starter, use_count FROM invitation_codes WHERE is_starter = true AND status = 'active' AND deleted_at IS NULL",
      []
    );
    if (row) {
      starter = publicCode(row);
      main = { ...starter };
    }
  }

  // Kode komunitas yang layak tampil untuk perangkat ini: aktif, bukan starter,
  // belum pernah diambil perangkat ini, dan bukan titipan perangkat ini sendiri.
  const eligible = await query<CodeRow>(
    `SELECT c.id, c.code, c.is_starter, c.use_count
       FROM invitation_codes c
      WHERE c.status = 'active'
        AND c.deleted_at IS NULL
        AND c.is_starter = false
        AND (c.owner_device_id IS NULL OR c.owner_device_id <> $1)
        AND NOT EXISTS (
          SELECT 1 FROM code_takes t WHERE t.code_id = c.id AND t.device_id = $1
        )
      ORDER BY c.use_count ASC, c.created_at ASC
      LIMIT 13`,
    [device.id]
  );

  if (!main && eligible.length > 0) {
    main = publicCode(eligible[0]);
  }
  const gridRows = main
    ? eligible.filter((r) => r.code !== main!.code).slice(0, 12)
    : eligible.slice(0, 12);

  // Kode yang sudah diambil perangkat ini, untuk ditampilkan sebagai kartu nonaktif.
  const taken = await query<{ code: string }>(
    `SELECT c.code FROM code_takes t
       JOIN invitation_codes c ON c.id = t.code_id
      WHERE t.device_id = $1
      ORDER BY t.taken_at DESC`,
    [device.id]
  );

  const statsRow = await queryOne<{ codes_ready: number; keys_shared: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM invitation_codes WHERE status = 'active' AND deleted_at IS NULL) AS codes_ready,
       (SELECT COUNT(*)::int FROM code_takes) AS keys_shared`,
    []
  );

  const body = {
    starter,
    main,
    grid: gridRows.map(publicCode),
    taken: taken.map((t) => t.code),
    stats: {
      codes_ready: statsRow?.codes_ready ?? 0,
      keys_shared: statsRow?.keys_shared ?? 0,
    },
  };
  const out = NextResponse.json(body);
  copyDeviceCookie(res, out);
  return out;
}
