import { query, queryOne } from "./db";

/**
 * Menambah hitungan bucket di database dan mengembalikan true bila melewati
 * batas. Disimpan di Postgres agar berlaku lintas instance (mis. Vercel).
 */
export async function rateLimited(
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const row = await queryOne<{ count: number }>(
    `INSERT INTO rate_limits AS r (bucket, count, reset_at)
     VALUES ($1, 1, now() + make_interval(secs => $2))
     ON CONFLICT (bucket) DO UPDATE SET
       count = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.count + 1 END,
       reset_at = CASE WHEN r.reset_at <= now() THEN EXCLUDED.reset_at ELSE r.reset_at END
     RETURNING count`,
    [bucket, windowSeconds]
  );
  if (Math.random() < 0.01) {
    await query("DELETE FROM rate_limits WHERE reset_at < now()");
  }
  return (row?.count ?? 0) > max;
}
