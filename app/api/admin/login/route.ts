import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { ADMIN_COOKIE, adminConfigured, createSessionToken, verifyPassword } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { ipHash, isHttps } from "@/lib/request";

export const dynamic = "force-dynamic";

const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_PER_IP = 10;
// Penahan bila penyerang berganti-ganti IP.
const MAX_PER_USERNAME = 100;

export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Login admin dimatikan: SESSION_SECRET belum diisi (minimal 32 karakter)." },
      { status: 503 }
    );
  }
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

  if (
    (await rateLimited(`login:ip:${ipHash(req)}`, MAX_PER_IP, LOGIN_WINDOW_SECONDS)) ||
    (await rateLimited(`login:user:${username.slice(0, 64)}`, MAX_PER_USERNAME, LOGIN_WINDOW_SECONDS))
  ) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan login. Coba lagi 15 menit lagi." },
      { status: 429 }
    );
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
    secure: isHttps(req),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return out;
}
