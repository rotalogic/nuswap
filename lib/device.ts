import { randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { queryOne } from "./db";
import { isHttps } from "./request";

export const DEVICE_COOKIE = "nuswap_device";

export interface DeviceRow {
  id: number;
  device_key: string;
}

/** Perangkat dari cookie httpOnly, atau null bila belum dikenal. Tidak menulis ke database. */
export async function findDevice(req: NextRequest): Promise<DeviceRow | null> {
  const key = req.cookies.get(DEVICE_COOKIE)?.value;
  if (!key) return null;
  return queryOne<DeviceRow>("SELECT id, device_key FROM devices WHERE device_key = $1", [key]);
}

/**
 * Seperti findDevice, tetapi membuat perangkat baru bila belum ada. Dipanggil
 * hanya saat pengunjung benar-benar mengambil atau menitip kunci, supaya bot
 * yang sekadar membuka halaman tidak menambah baris.
 */
export async function ensureDevice(req: NextRequest): Promise<DeviceRow> {
  const existing = await findDevice(req);
  if (existing) return existing;
  const row = await queryOne<DeviceRow>(
    "INSERT INTO devices (device_key) VALUES ($1) RETURNING id, device_key",
    [randomUUID()]
  );
  return row!;
}

export function withDeviceCookie<T extends NextResponse>(
  req: NextRequest,
  res: T,
  device: DeviceRow
): T {
  if (req.cookies.get(DEVICE_COOKIE)?.value !== device.device_key) {
    res.cookies.set(DEVICE_COOKIE, device.device_key, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps(req),
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
