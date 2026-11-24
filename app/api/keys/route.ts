import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { findDevice } from "@/lib/device";
import { ELIGIBLE_CODES, QUEUE_KEY, publicCode, type QueueRow } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const device = await findDevice(req);
  const deviceId = device?.id ?? 0;

  const takeCount = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM code_takes WHERE device_id = $1",
    [deviceId]
  );
  const isNewDevice = (takeCount?.n ?? 0) === 0;

  let starter = null;
  let main: ReturnType<typeof publicCode> | null = null;
  if (isNewDevice) {
    const row = await queryOne<QueueRow>(
      "SELECT id, code, use_count FROM invitation_codes WHERE is_starter = true AND status = 'active' AND deleted_at IS NULL",
      []
    );
    if (row) {
      starter = publicCode(row);
      main = { ...starter };
    }
  }

  // Diambil 11 baris: 1 untuk kartu utama (bila bukan starter) + 10 untuk grid.
  const eligible = await query<QueueRow>(
    `${ELIGIBLE_CODES} ORDER BY ${QUEUE_KEY} LIMIT 11`,
    [deviceId]
  );

  if (!main && eligible.length > 0) {
    main = publicCode(eligible[0]);
  }
  const gridRows = main
    ? eligible.filter((r) => r.code !== main!.code).slice(0, 10)
    : eligible.slice(0, 10);

  // Kode yang sudah diambil perangkat ini, untuk ditampilkan sebagai kartu nonaktif.
  const taken = await query<{ code: string }>(
    `SELECT c.code FROM code_takes t
       JOIN invitation_codes c ON c.id = t.code_id
      WHERE t.device_id = $1
      ORDER BY t.taken_at DESC`,
    [deviceId]
  );

  // Riwayat kunci perangkat ini: semua pengambilan dari code_takes, digabung
  // laporan terakhir per kode dari code_reports. Terbaru dulu, maks 50.
  const historyRows = await query<{
    code: string;
    taken_at: Date | string;
    report: "success" | "failed" | null;
  }>(
    `SELECT c.code, t.taken_at,
       (SELECT r.result FROM code_reports r
         WHERE r.device_id = t.device_id AND r.code_id = t.code_id
         ORDER BY r.created_at DESC
         LIMIT 1) AS report
       FROM code_takes t
       JOIN invitation_codes c ON c.id = t.code_id
      WHERE t.device_id = $1
      ORDER BY t.taken_at DESC
      LIMIT 50`,
    [deviceId]
  );
  const history = historyRows.map((h) => ({
    code: h.code,
    taken_at: new Date(h.taken_at).toISOString(),
    report: h.report ?? null,
  }));

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
    history,
    stats: {
      codes_ready: statsRow?.codes_ready ?? 0,
      keys_shared: statsRow?.keys_shared ?? 0,
    },
  };
  return NextResponse.json(body);
}
