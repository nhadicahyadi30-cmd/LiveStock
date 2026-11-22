// Webhook keluar: tanda tangan HMAC, penjaga SSRF, jadwal ulang. Fungsi murni dipisah dari fungsi database agar bisa diuji.
import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { withTenant, type Tx } from "@sl/database";

export const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [1, 5, 30, 120];
const TIMEOUT_MS = 5000;
const NIL = "00000000-0000-0000-0000-000000000000";

export const newWebhookSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;
export const signPayload = (secret: string, timestamp: number, body: string) => `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
/** Jeda sebelum percobaan berikutnya (percobaan ke-n sudah gagal). null = menyerah. */
export function nextDelayMs(attempts: number): number | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  return (BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] ?? 120) * 60_000;
}

/** Menolak alamat internal (SSRF). Alamat lokal hanya boleh bila ALLOW_PRIVATE_WEBHOOKS=true (untuk Node-RED lokal saat pengembangan). */
export function isSafeWebhookUrl(raw: string, allowPrivate = false): { ok: true } | { ok: false; reason: string } {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, reason: "URL tidak valid" }; }
  if (u.protocol !== "https:" && !(allowPrivate && u.protocol === "http:")) return { ok: false, reason: "Hanya https yang diizinkan" };
  if (u.username || u.password) return { ok: false, reason: "URL tidak boleh memuat nama pengguna/sandi" };
  if (allowPrivate) return { ok: true };
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return { ok: false, reason: "Alamat internal tidak diizinkan" };
  const kind = isIP(host);
  if (kind === 4) {
    const [a, b] = host.split(".").map(Number) as [number, number];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return { ok: false, reason: "Alamat IP internal tidak diizinkan" };
  } else if (kind === 6) {
    if (host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host.startsWith("::ffff:")) return { ok: false, reason: "Alamat IP internal tidak diizinkan" };
  }
  return { ok: true };
}
const allowPrivate = () => process.env.ALLOW_PRIVATE_WEBHOOKS === "true";
export const webhookUrlCheck = (url: string) => isSafeWebhookUrl(url, allowPrivate());

/** Dipanggil dalam transaksi tenant: membuat antrean pengiriman untuk endpoint yang berlangganan event ini. */
export async function emitEvent(tx: Tx, organizationId: string, event: string, data: Record<string, unknown>): Promise<void> {
  const endpoints = await tx.webhookEndpoint.findMany({ where: { active: true, events: { has: event } }, select: { id: true } });
  if (endpoints.length === 0) return;
  const payload = { event, createdAt: new Date().toISOString(), data };
  await tx.webhookDelivery.createMany({ data: endpoints.map((e) => ({ organizationId, endpointId: e.id, event, payload })) });
  // Kirim sebentar setelah transaksi selesai. Di lingkungan serverless ini bisa tidak jalan; kirim ulang lewat flush operator.
  const t = setTimeout(() => { void flushOrg(organizationId).catch(() => undefined); }, 1500);
  (t as { unref?: () => void }).unref?.();
}

async function attempt(url: string, secret: string, payload: unknown, deliveryId: string, event: string): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const check = webhookUrlCheck(url);
  if (!check.ok) return { ok: false, status: null, error: check.reason };
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(url, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "content-type": "application/json", "user-agent": "NusaTernak-Webhook/1", "x-nt-event": event, "x-nt-delivery": deliveryId, "x-nt-timestamp": String(ts), "x-nt-signature": signPayload(secret, ts, body) }, body });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, error: res.status >= 200 && res.status < 300 ? null : `HTTP ${res.status}` };
  } catch (e) { return { ok: false, status: null, error: (e as Error).name === "TimeoutError" ? "Waktu habis" : "Tidak bisa terhubung" }; }
}

/** Mengirim pengiriman yang jatuh tempo untuk satu organisasi. Mengembalikan jumlah yang diproses. */
export async function flushOrg(organizationId: string, only?: string): Promise<number> {
  const due = await withTenant({ organizationId, userId: NIL }, (tx) => tx.webhookDelivery.findMany({ where: only ? { id: only } : { status: "PENDING", nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: 25 }));
  let n = 0;
  for (const d of due) {
    const ep = await withTenant({ organizationId, userId: NIL }, (tx) => tx.webhookEndpoint.findUnique({ where: { id: d.endpointId } }));
    const r = ep ? await attempt(ep.url, ep.secret, d.payload, d.id, d.event) : { ok: false, status: null, error: "Endpoint sudah dihapus" };
    const attempts = d.attempts + 1;
    const delay = r.ok || !ep ? null : nextDelayMs(attempts);
    await withTenant({ organizationId, userId: NIL }, (tx) => tx.webhookDelivery.update({ where: { id: d.id }, data: r.ok ? { status: "DELIVERED", attempts, responseStatus: r.status, lastError: null, deliveredAt: new Date() } : { status: delay === null ? "FAILED" : "PENDING", attempts, responseStatus: r.status, lastError: r.error, ...(delay !== null ? { nextAttemptAt: new Date(Date.now() + delay) } : {}) } }));
    n++;
  }
  return n;
}
