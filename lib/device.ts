import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { queryOne } from "./db";

export const DEVICE_COOKIE = "nuswap_device";

export interface DeviceRow {
  id: number;
  device_key: string;
}

/**
 * Mengembalikan perangkat dari cookie httpOnly. Bila belum ada, perangkat baru
 * dibuat dan cookie-nya dipasang pada respons yang diberikan.
 */
export async function ensureDevice(
  req: NextRequest,
  res: NextResponse
): Promise<DeviceRow> {
  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  if (existing) {
    const row = await queryOne<DeviceRow>(
      "SELECT id, device_key FROM devices WHERE device_key = $1",
      [existing]
    );
    if (row) return row;
  }
  const key = randomUUID();
  const row = await queryOne<DeviceRow>(
    "INSERT INTO devices (device_key) VALUES ($1) ON CONFLICT (device_key) DO UPDATE SET device_key = EXCLUDED.device_key RETURNING id, device_key",
    [key]
  );
  res.cookies.set(DEVICE_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return row!;
}

/** Menyalin cookie perangkat (bila baru dibuat) dari respons draf ke respons akhir. */
export function copyDeviceCookie(from: NextResponse, to: NextResponse): void {
  const c = from.cookies.get(DEVICE_COOKIE);
  if (c) {
    to.cookies.set(DEVICE_COOKIE, c.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
}
