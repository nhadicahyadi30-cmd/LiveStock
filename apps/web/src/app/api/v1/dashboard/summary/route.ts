import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/v1/dashboard/summary -> angka ringkas, deret kematian 30 hari, populasi per batch, aktivitas terbaru.
export const GET = tenantRoute({ permission: "dashboard.read" }, async (c) => {
  const restricted = c.allowedFarmIds !== null;
  const farmScope = restricted ? { farmId: { in: c.allowedFarmIds ?? [] } } : {};

  const farms = await c.tx.farm.count({ where: restricted ? { id: { in: c.allowedFarmIds ?? [] } } : {} });
  const batches = await c.tx.livestockBatch.findMany({ where: { ...farmScope }, select: { id: true, code: true, status: true, initialCount: true } });
  const animals = restricted ? await c.tx.animal.findMany({ where: farmScope, select: { id: true, code: true } }) : [];

  const active = batches.filter((b) => b.status === "ACTIVE");
  const ids = active.map((b) => b.id);
  const pops = ids.length
    ? await c.tx.$queryRaw<{ batch_id: string; current_count: bigint }[]>`SELECT batch_id, current_count FROM batch_population WHERE batch_id = ANY(${ids}::uuid[])`
    : [];
  const popBy = new Map(pops.map((r) => [r.batch_id, Number(r.current_count)]));
  const byBatch = active
    .map((b) => ({ id: b.id, code: b.code, population: popBy.get(b.id) ?? b.initialCount }))
    .sort((a, b) => b.population - a.population);

  // Pembatasan per farm: hanya catatan untuk batch/hewan di farm yang boleh diakses.
  const target = restricted
    ? { OR: [{ batchId: { in: batches.map((b) => b.id) } }, { animalId: { in: animals.map((a) => a.id) } }] }
    : {};

  const since = new Date(Date.now() - 29 * DAY);
  since.setUTCHours(0, 0, 0, 0);
  const mort = await c.tx.mortalityRecord.findMany({ where: { voidedAt: null, occurredOn: { gte: since }, ...target }, select: { occurredOn: true, count: true } });
  const perDay = new Map<string, number>();
  for (const m of mort) perDay.set(isoDay(m.occurredOn), (perDay.get(isoDay(m.occurredOn)) ?? 0) + m.count);
  const series = Array.from({ length: 30 }, (_, i) => {
    const date = isoDay(new Date(since.getTime() + i * DAY));
    return { date, count: perDay.get(date) ?? 0 };
  });

  const recentW = await c.tx.weightRecord.findMany({ where: { voidedAt: null, ...target }, orderBy: { createdAt: "desc" }, take: 6 });
  const recentM = await c.tx.mortalityRecord.findMany({ where: { voidedAt: null, ...target }, orderBy: { createdAt: "desc" }, take: 6 });
  const codeBatch = new Map(batches.map((b) => [b.id, b.code]));
  const needAnimals = [...recentW, ...recentM].map((r) => r.animalId).filter((x): x is string => !!x);
  const animalRows = needAnimals.length ? await c.tx.animal.findMany({ where: { id: { in: needAnimals } }, select: { id: true, code: true } }) : [];
  const codeAnimal = new Map(animalRows.map((a) => [a.id, a.code]));
  const labelOf = (r: { batchId: string | null; animalId: string | null }) => (r.batchId ? codeBatch.get(r.batchId) : r.animalId ? codeAnimal.get(r.animalId) : undefined) ?? "-";

  const recent = [
    ...recentW.map((r) => ({ id: r.id, type: "weight" as const, at: r.createdAt, label: labelOf(r), detail: `${Number(r.weightKg)} kg` })),
    ...recentM.map((r) => ({ id: r.id, type: "mortality" as const, at: r.createdAt, label: labelOf(r), detail: `${r.count} ekor` })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return Response.json({
    data: {
      farms,
      activeBatches: active.length,
      population: byBatch.reduce((n, b) => n + b.population, 0),
      mortality30d: series.reduce((n, s) => n + s.count, 0),
      mortalitySeries: series,
      byBatch: byBatch.slice(0, 8),
      recent,
    },
  });
});
