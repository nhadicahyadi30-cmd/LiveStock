import { can } from "@sl/permissions";
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

  const feedTarget = restricted ? { batchId: { in: batches.map((b) => b.id) } } : {};
  const since = new Date(Date.now() - 29 * DAY);
  since.setUTCHours(0, 0, 0, 0);
  const mort = await c.tx.mortalityRecord.findMany({ where: { voidedAt: null, occurredOn: { gte: since }, ...target }, select: { occurredOn: true, count: true } });
  const perDay = new Map<string, number>();
  for (const m of mort) perDay.set(isoDay(m.occurredOn), (perDay.get(isoDay(m.occurredOn)) ?? 0) + m.count);
  const series = Array.from({ length: 30 }, (_, i) => {
    const date = isoDay(new Date(since.getTime() + i * DAY));
    return { date, count: perDay.get(date) ?? 0 };
  });

  const feedRows = await c.tx.feedRecord.findMany({ where: { voidedAt: null, givenOn: { gte: since }, ...feedTarget }, select: { quantityKg: true, costTotal: true } });
  const prodRows = await c.tx.productionRecord.findMany({ where: { voidedAt: null, producedOn: { gte: since }, ...feedTarget }, select: { kind: true, quantity: true } });
  const production30d = { EGG: 0, MILK: 0, HARVEST: 0 } as Record<string, number>;
  for (const p of prodRows) production30d[p.kind] = (production30d[p.kind] ?? 0) + Number(p.quantity);

  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  const dueTasksRaw = await c.tx.task.findMany({
    where: { status: "OPEN", dueOn: { lte: today }, OR: [{ assignedTo: c.userId }, { assignedTo: null }, ...(can(c.role, "tasks.manage") ? [{ assignedTo: { not: null } }] : [])] },
    orderBy: { dueOn: "asc" },
    take: 5,
  });

  const soon = new Date(Date.now() + 7 * DAY);
  const [vaccDue, quarantineActive, withdrawalActive] = await Promise.all([
    c.tx.healthRecord.findMany({ where: { voidedAt: null, kind: "VACCINATION", status: "PLANNED", eventOn: { lte: soon }, ...feedTarget }, orderBy: { eventOn: "asc" }, take: 5 }),
    c.tx.healthRecord.count({ where: { voidedAt: null, kind: "QUARANTINE", status: "ACTIVE", ...feedTarget } }),
    c.tx.healthRecord.count({ where: { voidedAt: null, kind: "TREATMENT", withdrawalUntil: { gte: new Date(new Date().toISOString().slice(0, 10)) }, ...feedTarget } }),
  ]);

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
      feedKg30d: feedRows.reduce((n, r) => n + Number(r.quantityKg), 0),
      feedCost30d: feedRows.reduce((n, r) => n + Number(r.costTotal ?? 0), 0),
      production30d,
      health: { vaccinationsDue: vaccDue.map((v) => ({ id: v.id, title: v.title, eventOn: v.eventOn })), quarantineActive, withdrawalActive },
      dueTasks: dueTasksRaw.map((t) => ({ id: t.id, title: t.title, dueOn: t.dueOn })),
    },
  });
});
