import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // cegah injeksi rumus di Excel
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (head: string[], rows: unknown[][]) => "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");

// GET /api/v1/reports/export?type=weight|mortality|feed|production|population  -> CSV (bisa dibuka di Excel)
export const GET = tenantRoute({ permission: "records.read" }, async (c) => {
  const type = new URL(c.req.url).searchParams.get("type");
  const batches = await c.tx.livestockBatch.findMany({ where: c.allowedFarmIds ? { farmId: { in: c.allowedFarmIds } } : {}, select: { id: true, code: true, initialCount: true, startDate: true, status: true } });
  const code = new Map(batches.map((b) => [b.id, b.code]));
  const scope = { batchId: { in: batches.map((b) => b.id) }, voidedAt: null };
  let body: string;

  if (type === "weight") {
    const r = await c.tx.weightRecord.findMany({ where: { ...scope }, orderBy: { measuredOn: "desc" }, take: 20000 });
    body = csv(["Tanggal", "Batch", "Bobot rata-rata (kg)", "Jumlah sampel", "Catatan"], r.map((x) => [x.measuredOn, x.batchId ? code.get(x.batchId) : "", Number(x.weightKg), x.sampleSize, ""]));
  } else if (type === "mortality") {
    const r = await c.tx.mortalityRecord.findMany({ where: { ...scope }, orderBy: { occurredOn: "desc" }, take: 20000 });
    body = csv(["Tanggal", "Batch", "Jumlah ekor", "Penyebab", "Catatan"], r.map((x) => [x.occurredOn, x.batchId ? code.get(x.batchId) : "", x.count, x.cause, x.note]));
  } else if (type === "feed") {
    const [r, types] = await Promise.all([c.tx.feedRecord.findMany({ where: { ...scope }, orderBy: { givenOn: "desc" }, take: 20000 }), c.tx.feedType.findMany()]);
    const name = new Map(types.map((t) => [t.id, t.name]));
    body = csv(["Tanggal", "Batch", "Pakan", "Jumlah (kg)", "Biaya (Rp)", "Catatan"], r.map((x) => [x.givenOn, code.get(x.batchId), name.get(x.feedTypeId), Number(x.quantityKg), x.costTotal === null ? "" : Number(x.costTotal), x.note]));
  } else if (type === "production") {
    const r = await c.tx.productionRecord.findMany({ where: { ...scope }, orderBy: { producedOn: "desc" }, take: 20000 });
    body = csv(["Tanggal", "Batch", "Jenis", "Jumlah", "Satuan", "Catatan"], r.map((x) => [x.producedOn, code.get(x.batchId), x.kind, Number(x.quantity), x.unit, x.note]));
  } else if (type === "population") {
    const pop = await c.tx.$queryRaw<{ batch_id: string; population: number }[]>`SELECT batch_id, current_count::int AS population FROM batch_population`;
    const p = new Map(pop.map((x) => [x.batch_id, x.population]));
    body = csv(["Batch", "Status", "Tanggal mulai", "Populasi awal", "Populasi sekarang"], batches.map((b) => [b.code, b.status, b.startDate, b.initialCount, p.get(b.id) ?? ""]));
  } else {
    throw new ApiError(400, "BAD_REQUEST", "Jenis laporan tidak dikenal");
  }

  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="nusa-ternak-${type}-${new Date().toISOString().slice(0, 10)}.csv"` } });
});
