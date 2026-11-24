import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ADMIN_COOKIE, createSessionToken, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username dan password wajib diisi." }, { status: 400 });
  }

  const admin = await queryOne<{ username: string; password_hash: string }>(
    "SELECT username, password_hash FROM admin_users WHERE username = $1",
    [username]
  );
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }

  const out = NextResponse.json({ ok: true, username: admin.username });
  out.cookies.set(ADMIN_COOKIE, createSessionToken(admin.username), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return out;
}
