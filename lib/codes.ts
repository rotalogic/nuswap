export const CODE_REGEX = /^NG-[A-Za-z0-9]{8}$/;

export function deepLink(code: string): string {
  return `https://services.nusuk.sa/app/?p=27&id=${code}`;
}

const MAX_INPUT = 2000;
// Batas kata di kedua sisi, supaya kode yang kepanjangan ditolak, bukan dipotong.
const CODE_IN_TEXT = /(?<![A-Za-z0-9])NG-[A-Za-z0-9]{8}(?![A-Za-z0-9])/;

/**
 * Menerima kode langsung ("NG-xxxxxxxx"), tautan Nusuk utuh
 * ("https://services.nusuk.sa/app/?p=27&id=NG-xxxxxxxx"), atau teks yang memuat
 * salah satunya. Mengembalikan kode persis seperti ditempel (case
 * dipertahankan) atau null.
 */
export function extractCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > MAX_INPUT) return null;
  // Tautan yang di-encode menulis "-" sebagai %2D dan "=" sebagai %3D.
  const text = input.replace(/%2D/gi, "-").replace(/%3D/gi, "=");
  return text.match(CODE_IN_TEXT)?.[0] ?? null;
}
