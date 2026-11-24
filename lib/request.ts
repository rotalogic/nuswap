import { createHmac } from "crypto";
import type { NextRequest } from "next/server";

/**
 * IP pengunjung. Isi paling kiri X-Forwarded-For bisa dikarang klien, jadi yang
 * dipercaya hanya entri yang ditambahkan proxy sendiri, dihitung dari kanan.
 * TRUSTED_PROXY_HOPS = jumlah proxy di depan aplikasi (bawaan 1).
 */
export function clientIp(req: NextRequest): string {
  if (process.env.VERCEL) {
    const vercelIp = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (vercelIp) return vercelIp;
  }
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length === 0) return "local";
  const parsed = Number(process.env.TRUSTED_PROXY_HOPS);
  const hops = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  return chain[Math.max(0, chain.length - hops)];
}

/** Sidik IP untuk rate limit dan laporan, supaya IP mentah tidak tersimpan. */
export function ipHash(req: NextRequest): string {
  const key = process.env.SESSION_SECRET || process.env.DATABASE_URL || "nuswap";
  return createHmac("sha256", key).update(`ip:${clientIp(req)}`).digest("base64url").slice(0, 24);
}

/** Cookie Secure hanya dipasang lewat HTTPS, agar http://localhost tetap jalan. */
export function isHttps(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return (proto ?? req.nextUrl.protocol.replace(":", "")) === "https";
}
