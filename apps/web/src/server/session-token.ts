// Token sesi tanpa dependensi: payload JSON base64url + tanda tangan HMAC-SHA256.
// Stateless; untuk mencabut sesi lebih awal, ganti SESSION_SECRET (semua sesi keluar) atau pindah ke sesi di database.
import { createHmac, timingSafeEqual } from "node:crypto";

export interface TokenPayload {
  uid: string;
  org: string | null;
  exp: number; // detik sejak epoch
}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const b64 = (buf: Buffer) => buf.toString("base64url");
const sign = (data: string, secret: string) => b64(createHmac("sha256", secret).update(data).digest());

export function signSession(
  data: { userId: string; organizationId: string | null },
  secret: string,
  now = Date.now(),
): string {
  const payload: TokenPayload = {
    uid: data.userId,
    org: data.organizationId,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body, secret)}`;
}

export function verifySession(token: string, secret: string, now = Date.now()): TokenPayload | null {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;

  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (typeof p.uid !== "string" || typeof p.exp !== "number") return null;
    if (p.exp * 1000 <= now) return null;
    return { uid: p.uid, org: typeof p.org === "string" ? p.org : null, exp: p.exp };
  } catch {
    return null;
  }
}

/** Rahasia penandatangan sesi dari environment; null bila belum diset atau terlalu pendek. */
export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}
