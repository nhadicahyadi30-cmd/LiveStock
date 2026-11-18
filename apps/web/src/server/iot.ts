import { prisma, withTenant, type Tx } from "@sl/database";
import { IOT_MAX_READINGS, METRIC_INFO, metricName, readingsPayload } from "@sl/validation";
import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "./errors";

export const ONLINE_WINDOW_MS = 5 * 60_000;
const MAX_AGE_MS = 7 * 864e5;
const MAX_FUTURE_MS = 5 * 60_000;

export const hashDeviceToken = (t: string) => createHash("sha256").update(t).digest("hex");
export function newDeviceToken(): { token: string; hash: string; prefix: string } {
  const token = `nt_dev_${randomBytes(24).toString("base64url")}`;
  return { token, hash: hashDeviceToken(token), prefix: token.slice(0, 12) };
}

export interface DeviceAuth { id: string; organizationId: string; farmId: string; name: string; createdBy: string }

// Pembatas laju sederhana per perangkat (dalam memori proses; cukup untuk satu instans, ganti Redis saat skala).
const buckets = new Map<string, { n: number; reset: number }>();
export const RATE_LIMIT_PER_MIN = 120;
function rateLimit(deviceId: string): void {
  const now = Date.now();
  const b = buckets.get(deviceId);
  if (!b || b.reset < now) { buckets.set(deviceId, { n: 1, reset: now + 60_000 }); return; }
  if (++b.n > RATE_LIMIT_PER_MIN) throw new ApiError(429, "RATE_LIMITED", `Terlalu sering mengirim (maks. ${RATE_LIMIT_PER_MIN} permintaan per menit)`);
}

/** Mengenali perangkat dari token (Authorization: Bearer ... atau X-Device-Token). Perangkat nonaktif ditolak. */
export async function authenticateDevice(req: Request): Promise<DeviceAuth> {
  const auth = req.headers.get("authorization");
  const token = (auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : req.headers.get("x-device-token"))?.trim();
  if (!token || token.length > 200 || !token.startsWith("nt_dev_")) throw new ApiError(401, "INVALID_DEVICE_TOKEN", "Token perangkat tidak ada atau tidak valid");
  const hash = hashDeviceToken(token);
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.device_token_hash', ${hash}, true) AS h`;
    return tx.device.findMany({ where: { tokenHash: hash }, take: 1 });
  });
  const d = rows[0];
  if (!d) throw new ApiError(401, "INVALID_DEVICE_TOKEN", "Token perangkat tidak ada atau tidak valid");
  if (d.status !== "ACTIVE") throw new ApiError(403, "DEVICE_DISABLED", "Perangkat dinonaktifkan");
  rateLimit(d.id);
  return { id: d.id, organizationId: d.organizationId, farmId: d.farmId, name: d.name, createdBy: d.createdBy };
}

function parseTs(ts: string | number | undefined, now: number): Date | null {
  if (ts === undefined) return new Date(now);
  const ms = typeof ts === "number" ? (ts < 1e11 ? ts * 1000 : ts) : Date.parse(ts);
  if (!Number.isFinite(ms) || ms > now + MAX_FUTURE_MS || ms < now - MAX_AGE_MS) return null;
  return new Date(ms);
}

/** Menyatukan tiga bentuk kiriman menjadi daftar pembacaan yang seragam. */
export function normalizePayload(body: unknown): { metric: string; value: number; ts?: string | number | undefined }[] {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new ApiError(422, "VALIDATION_ERROR", "Isi harus berupa objek JSON");
  const o = body as Record<string, unknown>;
  if (Array.isArray(o.readings)) return readingsPayload.parse(o).readings;
  const ts = (typeof o.ts === "string" || typeof o.ts === "number" ? o.ts : undefined) as string | number | undefined;
  if (typeof o.metric === "string") return readingsPayload.parse({ readings: [{ metric: o.metric, value: o.value, ts }] }).readings;
  const flat = Object.entries(o).filter(([k]) => k !== "ts");
  if (flat.length === 0) throw new ApiError(422, "VALIDATION_ERROR", "Tidak ada data yang dikirim");
  if (flat.length > IOT_MAX_READINGS) throw new ApiError(422, "VALIDATION_ERROR", `Maksimal ${IOT_MAX_READINGS} metrik per kiriman`);
  return readingsPayload.parse({ readings: flat.map(([metric, value]) => ({ metric: metricName.parse(metric), value, ts })) }).readings;
}

export interface IngestResult { accepted: number; rejected: number; alerts: number }

/** Menyimpan pembacaan, memperbarui "terakhir terlihat", dan mengevaluasi aturan alarm. */
export async function ingest(dev: DeviceAuth, items: ReturnType<typeof normalizePayload>): Promise<IngestResult> {
  const now = Date.now();
  const rows: { metric: string; value: number; recordedAt: Date }[] = [];
  for (const it of items) { const at = parseTs(it.ts, now); if (at) rows.push({ metric: it.metric, value: it.value, recordedAt: at }); }
  const rejected = items.length - rows.length;

  const alerts = await withTenant({ organizationId: dev.organizationId, userId: dev.createdBy }, async (tx) => {
    if (rows.length > 0) await tx.sensorReading.createMany({ data: rows.map((r) => ({ ...r, organizationId: dev.organizationId, deviceId: dev.id })) });
    await tx.device.update({ where: { id: dev.id }, data: { lastSeenAt: new Date(now) } });
    return rows.length > 0 ? evaluateRules(tx, dev, rows) : 0;
  });
  return { accepted: rows.length, rejected, alerts };
}

/** Nilai terbaru per metrik dalam kiriman ini dibandingkan dengan aturan. Alarm terbuka sampai nilai kembali normal. */
async function evaluateRules(tx: Tx, dev: DeviceAuth, rows: { metric: string; value: number; recordedAt: Date }[]): Promise<number> {
  const latest = new Map<string, { value: number; at: number }>();
  for (const r of rows) { const cur = latest.get(r.metric); if (!cur || r.recordedAt.getTime() >= cur.at) latest.set(r.metric, { value: r.value, at: r.recordedAt.getTime() }); }
  const rules = await tx.alertRule.findMany({ where: { deviceId: dev.id, enabled: true, metric: { in: [...latest.keys()] } } });
  if (rules.length === 0) return 0;

  let fired = 0;
  const recipients = await tx.membership.findMany({ where: { status: "ACTIVE", role: { in: ["OWNER", "MANAGER"] } }, select: { userId: true } });
  for (const rule of rules) {
    const v = latest.get(rule.metric)!.value;
    const violated = rule.op === "GT" ? v > rule.threshold : v < rule.threshold;
    const open = await tx.alertEvent.findFirst({ where: { ruleId: rule.id, resolvedAt: null } });
    if (violated && !open) {
      await tx.alertEvent.create({ data: { organizationId: dev.organizationId, ruleId: rule.id, deviceId: dev.id, ruleName: rule.name, metric: rule.metric, op: rule.op, threshold: rule.threshold, value: v } });
      const info = METRIC_INFO[rule.metric];
      const body = `${dev.name}: ${info?.label ?? rule.metric} ${v}${info?.unit ?? ""} (batas ${rule.op === "GT" ? "maks." : "min."} ${rule.threshold}${info?.unit ?? ""})`;
      if (recipients.length > 0) await tx.notification.createMany({ data: recipients.map((m) => ({ organizationId: dev.organizationId, userId: m.userId, kind: "iot.alert", title: `Alarm: ${rule.name}`, body, href: `/app/iot/${dev.id}` })) });
      fired++;
    } else if (!violated && open) {
      await tx.alertEvent.updateMany({ where: { ruleId: rule.id, resolvedAt: null }, data: { resolvedAt: new Date() } });
    }
  }
  return fired;
}

// ---- helper untuk endpoint berbasis sesi (pengguna), bukan perangkat ----
import { assertFarmAccess } from "./farm-access";
import type { TenantRequestContext } from "./tenant-guard";

/** Perangkat milik organisasi aktif dan farm yang boleh diakses pengguna; selain itu 404. */
export async function loadDevice(c: TenantRequestContext<unknown>, id: string) {
  const d = await c.tx.device.findUnique({ where: { id } });
  if (!d || d.organizationId !== c.organizationId) throw new ApiError(404, "NOT_FOUND", "Perangkat tidak ditemukan");
  assertFarmAccess(c, d.farmId);
  return d;
}
export const isOnline = (lastSeenAt: Date | null) => !!lastSeenAt && Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
