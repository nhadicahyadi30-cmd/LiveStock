import { uuid } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { assertFarmAccess } from "@/server/farm-access";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/batches/:id -> detail batch, populasi, serta catatan bobot dan kematian (termasuk yang dibatalkan).
export const GET = tenantRoute<{ id: string }>({ permission: "records.read" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const batch = await c.tx.livestockBatch.findUnique({ where: { id } });
  if (!batch) throw new ApiError(404, "NOT_FOUND", "Batch tidak ditemukan");
  assertFarmAccess(c, batch.farmId);

  const pop = await c.tx.$queryRaw<{ current_count: bigint }[]>`SELECT current_count FROM batch_population WHERE batch_id = ${id}::uuid`;
  const weights = await c.tx.weightRecord.findMany({ where: { batchId: id }, orderBy: [{ measuredOn: "desc" }, { id: "desc" }], take: 100 });
  const mortalities = await c.tx.mortalityRecord.findMany({ where: { batchId: id }, orderBy: [{ occurredOn: "desc" }, { id: "desc" }], take: 100 });

  const events = await c.tx.batchEvent.findMany({ where: { batchId: id }, orderBy: [{ occurredOn: "desc" }, { id: "desc" }], take: 100 });
  const feed = await c.tx.feedRecord.findMany({ where: { batchId: id }, orderBy: [{ givenOn: "desc" }, { id: "desc" }], take: 100 });
  const feedTypes = feed.length ? await c.tx.feedType.findMany({ where: { id: { in: [...new Set(feed.map((f) => f.feedTypeId))] } } }) : [];
  const feedName = new Map(feedTypes.map((t) => [t.id, t.name]));
  const production = await c.tx.productionRecord.findMany({ where: { batchId: id }, orderBy: [{ producedOn: "desc" }, { id: "desc" }], take: 100 });

  return Response.json({
    data: {
      batch: { ...batch, currentCount: Number(pop[0]?.current_count ?? batch.initialCount) },
      weights: weights.map((w) => ({ ...w, weightKg: Number(w.weightKg) })),
      mortalities,
      events,
      feed: feed.map((f) => ({ ...f, quantityKg: Number(f.quantityKg), costTotal: f.costTotal === null ? null : Number(f.costTotal), feedName: feedName.get(f.feedTypeId) ?? "-" })),
      production: production.map((p) => ({ ...p, quantity: Number(p.quantity) })),
    },
  });
});
