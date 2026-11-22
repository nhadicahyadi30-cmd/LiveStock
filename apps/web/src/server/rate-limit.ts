// Pembatas laju jendela tetap dalam memori proses (satu instans). Untuk beberapa instans, pindahkan ke Redis.
import { ApiError } from "./errors";

interface Bucket { n: number; reset: number }
const buckets = new Map<string, Bucket>();

/** Menghitung satu percobaan. ok=false bila batas terlewati; retryAfterSec = sisa waktu tunggu. Murni kecuali Map di atas. */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset <= now) { buckets.set(key, { n: 1, reset: now + windowMs }); return { ok: true, retryAfterSec: 0 }; }
  b.n += 1;
  return b.n > limit ? { ok: false, retryAfterSec: Math.ceil((b.reset - now) / 1000) } : { ok: true, retryAfterSec: 0 };
}
export const resetKey = (key: string): void => { buckets.delete(key); };
export const _clearForTest = (): void => buckets.clear();

/** Melempar 429 bila batas terlewati. */
export function limitOrThrow(key: string, limit: number, windowMs: number, what: string): void {
  const r = hit(key, limit, windowMs);
  if (!r.ok) throw new ApiError(429, "RATE_LIMITED", `Terlalu banyak percobaan ${what}. Coba lagi sekitar ${Math.ceil(r.retryAfterSec / 60)} menit lagi.`);
}
