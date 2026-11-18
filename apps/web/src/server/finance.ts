import type { Tx } from "@sl/database";
import { ApiError } from "./errors";

/** Keuangan menyangkut seluruh usaha; anggota yang dibatasi ke farm tertentu tidak boleh melihatnya. */
export function requireFullAccess(allowedFarmIds: string[] | null): void {
  if (allowedFarmIds !== null) throw new ApiError(403, "FORBIDDEN", "Keuangan hanya untuk anggota dengan akses ke semua farm");
}

export const ym = (d: Date) => d.toISOString().slice(0, 7);
/** Awal bulan (UTC) dari string YYYY-MM, dan bulan berikutnya. */
export function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}
export const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

export interface Cost { date: Date; category: "PAKAN" | "KESEHATAN"; amount: number; batchId: string }

/** Biaya otomatis: pakan (feed_records.cost_total) dan kesehatan (health_records.cost; vaksin dihitung bila sudah dilakukan). */
export async function autoCosts(tx: Tx, from: Date, to: Date): Promise<Cost[]> {
  const [feed, health] = await Promise.all([
    tx.feedRecord.findMany({ where: { voidedAt: null, costTotal: { not: null }, givenOn: { gte: from, lt: to } }, select: { givenOn: true, costTotal: true, batchId: true } }),
    tx.healthRecord.findMany({ where: { voidedAt: null, cost: { not: null }, OR: [{ kind: { not: "VACCINATION" }, eventOn: { gte: from, lt: to } }, { kind: "VACCINATION", status: "DONE", doneOn: { gte: from, lt: to } }] }, select: { eventOn: true, doneOn: true, cost: true, batchId: true, kind: true } }),
  ]);
  return [
    ...feed.map((r) => ({ date: r.givenOn, category: "PAKAN" as const, amount: Number(r.costTotal), batchId: r.batchId })),
    ...health.map((r) => ({ date: r.kind === "VACCINATION" ? (r.doneOn ?? r.eventOn) : r.eventOn, category: "KESEHATAN" as const, amount: Number(r.cost), batchId: r.batchId })),
  ];
}

/** Batch harus ada di organisasi ini; batch yang sudah ditutup tetap boleh dipakai (penjualan setelah panen). */
export async function assertBatchExists(tx: Tx, organizationId: string, batchId: string): Promise<void> {
  const b = await tx.livestockBatch.findUnique({ where: { organizationId_id: { organizationId, id: batchId } }, select: { id: true } });
  if (!b) throw new ApiError(404, "NOT_FOUND", "Batch tidak ditemukan");
}
