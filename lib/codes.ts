export const CODE_REGEX = /^NG-[A-Za-z0-9]{8}$/;

export function deepLink(code: string): string {
  return `https://services.nusuk.sa/app/?p=27&id=${code}`;
}

/**
 * Menerima kode langsung ("NG-xxxxxxxx") atau tautan Nusuk utuh
 * ("https://services.nusuk.sa/app/?p=27&id=NG-xxxxxxxx").
 * Mengembalikan kode persis seperti ditempel (case dipertahankan) atau null.
 */
export function extractCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (trimmed.includes("id=")) {
    const match = trimmed.match(/[?&]id=([^&\s]+)/);
    if (match) {
      try {
        candidate = decodeURIComponent(match[1]);
      } catch {
        candidate = match[1];
      }
    }
  } else {
    const bare = trimmed.match(/NG-[A-Za-z0-9]{8}/);
    if (bare) candidate = bare[0];
  }
  return CODE_REGEX.test(candidate) ? candidate : null;
}
