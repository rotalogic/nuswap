import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface WinnerRow {
  draw_no: number;
  name: string;
  country: string;
  draw_date: string;
  is_indonesia: boolean;
}

function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET() {
  const rows = await query<WinnerRow>(
    `SELECT draw_no, name, country,
            to_char(draw_date, 'YYYY-MM-DD') AS draw_date, is_indonesia
       FROM winners
      ORDER BY draw_no DESC`
  );
  const today = rows.find((w) => w.draw_date === todayWIB()) ?? null;
  return NextResponse.json({ today, winners: rows });
}
