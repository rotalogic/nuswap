import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!readSession(req)) {
    return NextResponse.json({ error: "Belum login sebagai admin." }, { status: 401 });
  }
  let body: { draw_no?: unknown; name?: unknown; country?: unknown; draw_date?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const drawNo = Number(body.draw_no);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim() : "";
  const drawDate = typeof body.draw_date === "string" ? body.draw_date : "";
  // Tanggal seperti 2026-02-31 lolos pola angka tetapi ditolak database.
  const parsedDate = new Date(`${drawDate}T00:00:00Z`);
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(drawDate) &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === drawDate;
  if (!Number.isInteger(drawNo) || drawNo <= 0 || !name || !country || !validDate) {
    return NextResponse.json(
      { error: "Isi nomor undian, nama, negara, dan tanggal (YYYY-MM-DD) dengan benar." },
      { status: 400 }
    );
  }
  try {
    const row = await queryOne(
      `INSERT INTO winners (draw_no, name, country, draw_date, is_indonesia)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, draw_no, name, country`,
      [drawNo, name, country, drawDate, country.toLowerCase() === "indonesia"]
    );
    return NextResponse.json({ ok: true, winner: row });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: `Pemenang nomor ${drawNo} sudah tercatat.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
