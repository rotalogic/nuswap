import { NextRequest, NextResponse } from "next/server";
import { transaction } from "@/lib/db";
import { findDevice } from "@/lib/device";
import { CODE_REGEX } from "@/lib/codes";
import { rateLimited } from "@/lib/ratelimit";
import { ipHash } from "@/lib/request";

export const dynamic = "force-dynamic";

// Kode dipensiunkan bila di antara suara terakhir ada minimal MIN_FAILURES
// gagal dan gagal lebih banyak dari berhasil.
const RECENT_VOTES = 10;
const MIN_FAILURES = 3;

export async function POST(req: NextRequest) {
  const reporter = ipHash(req);
  if (await rateLimited(`report:${reporter}`, 60, 60)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
  }

  let body: { code?: unknown; result?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const code = typeof body?.code === "string" ? body.code : "";
  const result = body?.result;
  if (!CODE_REGEX.test(code)) {
    return NextResponse.json({ error: "Format kode tidak valid." }, { status: 400 });
  }
  if (result !== "success" && result !== "failed") {
    return NextResponse.json({ error: "Hasil laporan harus 'success' atau 'failed'." }, { status: 400 });
  }

  const device = await findDevice(req);
  const outcome = device && (await recordReport(device.id, code, result, reporter));
  if (!outcome) {
    return NextResponse.json(
      { error: "Hanya kode yang pernah kamu ambil yang bisa dilaporkan." },
      { status: 403 }
    );
  }
  return NextResponse.json({ ok: true, code, ...outcome });
}

/** Mencatat laporan dan menghitung ulang status kode. Null bila perangkat tidak pernah mengambil kodenya. */
function recordReport(deviceId: number, code: string, result: string, reporter: string) {
  return transaction(async (client) => {
    // Kunci baris kode, supaya laporan bersamaan dihitung satu per satu.
    const row = (
      await client.query<{ id: number; status: string }>(
        `SELECT c.id, c.status FROM invitation_codes c
          WHERE c.code = $1 AND c.deleted_at IS NULL
            AND EXISTS (SELECT 1 FROM code_takes t WHERE t.code_id = c.id AND t.device_id = $2)
          FOR UPDATE OF c`,
        [code, deviceId]
      )
    ).rows[0];
    if (!row) return null;

    // clock_timestamp, bukan now(): now() beku sejak transaksi dimulai, jadi
    // laporan yang menunggu kunci bisa tercatat lebih tua dari yang mendahuluinya.
    const updated = await client.query(
      `UPDATE code_reports SET result = $3, ip_hash = $4, created_at = clock_timestamp()
        WHERE device_id = $1 AND code_id = $2`,
      [deviceId, row.id, result, reporter]
    );
    if (updated.rowCount === 0) {
      await client.query(
        `INSERT INTO code_reports (device_id, code_id, result, ip_hash, created_at)
         VALUES ($1, $2, $3, $4, clock_timestamp())`,
        [deviceId, row.id, result, reporter]
      );
    }

    // Satu suara per IP (laporan lama tanpa IP: per perangkat), hanya dari
    // perangkat yang memang mengambil kodenya, sejak terakhir diaktifkan ulang.
    const votes = (
      await client.query<{ failed: number; failed_recent: number; success_recent: number }>(
        `WITH votes AS (
           SELECT DISTINCT ON (voter) voter, result, created_at
             FROM (
               SELECT COALESCE(r.ip_hash, 'device:' || r.device_id) AS voter,
                      r.result, r.created_at, r.id
                 FROM code_reports r
                 JOIN code_takes t ON t.device_id = r.device_id AND t.code_id = r.code_id
                 JOIN invitation_codes c ON c.id = r.code_id
                WHERE r.code_id = $1
                  AND (c.reports_since IS NULL OR r.created_at > c.reports_since)
             ) all_reports
            ORDER BY voter, created_at DESC, id DESC
         ),
         recent AS (SELECT result FROM votes ORDER BY created_at DESC LIMIT ${RECENT_VOTES})
         SELECT
           (SELECT COUNT(*)::int FROM votes WHERE result = 'failed') AS failed,
           (SELECT COUNT(*)::int FROM recent WHERE result = 'failed') AS failed_recent,
           (SELECT COUNT(*)::int FROM recent WHERE result = 'success') AS success_recent`,
        [row.id]
      )
    ).rows[0];

    const retire =
      result === "failed" &&
      votes.failed_recent >= MIN_FAILURES &&
      votes.failed_recent > votes.success_recent;
    const status = retire ? "retired" : row.status;
    await client.query("UPDATE invitation_codes SET fail_count = $1, status = $2 WHERE id = $3", [
      votes.failed,
      status,
      row.id,
    ]);
    return { failCount: votes.failed, status };
  });
}
