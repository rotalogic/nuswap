import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!readSession(req)) {
    return NextResponse.json({ error: "Belum login sebagai admin." }, { status: 401 });
  }
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "ID kode tidak valid." }, { status: 400 });
  }
  // reports_since mengabaikan laporan lama, supaya satu laporan gagal
  // berikutnya tidak langsung memensiunkan kode ini lagi.
  const res = await getPool().query(
    `UPDATE invitation_codes
        SET status = 'active', fail_count = 0, reports_since = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, code, status`,
    [numericId]
  );
  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Kode tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, code: res.rows[0] });
}
