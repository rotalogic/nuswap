import { deepLink } from "./codes";

export interface QueueRow {
  id: number;
  code: string;
  use_count: number;
}

export function publicCode(row: QueueRow) {
  return { code: row.code, deepLink: deepLink(row.code), useCount: row.use_count };
}

// Kode komunitas yang layak tampil untuk perangkat $1: aktif, bukan starter,
// bukan titipan perangkat ini sendiri, dan belum pernah diambil perangkat ini.
export const ELIGIBLE_CODES = `
  SELECT c.id, c.code, c.use_count
    FROM invitation_codes c
   WHERE c.status = 'active'
     AND c.deleted_at IS NULL
     AND c.is_starter = false
     AND (c.owner_device_id IS NULL OR c.owner_device_id <> $1)
     AND NOT EXISTS (
       SELECT 1 FROM code_takes t WHERE t.code_id = c.id AND t.device_id = $1
     )`;

// Urutan antrean: titipan peserta selalu di atas kunci cadangan dari seed
// pemilik (owner_device_id NULL); di dalam tiap kelompok, yang paling sedikit
// dipakai dulu, lalu yang paling lama menunggu.
export const QUEUE_KEY = "(c.owner_device_id IS NULL), c.use_count, c.created_at, c.id";
