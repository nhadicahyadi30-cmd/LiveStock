import { prisma, withTenant, type Tx } from "@sl/database";
import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "./errors";

export const hashApiKey = (k: string) => createHash("sha256").update(k).digest("hex");
export function newApiKey(): { key: string; hash: string; prefix: string } {
  const key = `nt_key_${randomBytes(28).toString("base64url")}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 14) };
}

const buckets = new Map<string, { n: number; reset: number }>();
export const API_RATE_PER_MIN = 60;
function rateLimit(id: string): void {
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.reset < now) { buckets.set(id, { n: 1, reset: now + 60_000 }); return; }
  if (++b.n > API_RATE_PER_MIN) throw new ApiError(429, "RATE_LIMITED", `Terlalu banyak permintaan (maks. ${API_RATE_PER_MIN} per menit)`);
}

/** Mengenali kunci API dari header Authorization: Bearer nt_key_... lalu menjalankan fn dalam konteks organisasinya (RLS tetap berlaku). */
export async function withApiKey<T>(req: Request, fn: (tx: Tx, ctx: { organizationId: string; keyId: string }) => Promise<T>): Promise<T> {
  const auth = req.headers.get("authorization");
  const key = (auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "").trim();
  if (!key || key.length > 200 || !key.startsWith("nt_key_")) throw new ApiError(401, "INVALID_API_KEY", "Kunci API tidak ada atau tidak valid");
  const hash = hashApiKey(key);
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.api_key_hash', ${hash}, true) AS h`;
    return tx.apiKey.findMany({ where: { keyHash: hash }, take: 1 });
  });
  const k = rows[0];
  if (!k || k.revokedAt) throw new ApiError(401, "INVALID_API_KEY", "Kunci API tidak ada atau sudah dicabut");
  rateLimit(k.id);
  return withTenant({ organizationId: k.organizationId, userId: k.createdBy }, async (tx) => {
    if (!k.lastUsedAt || Date.now() - k.lastUsedAt.getTime() > 60_000) await tx.apiKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date() } });
    return fn(tx, { organizationId: k.organizationId, keyId: k.id });
  });
}
