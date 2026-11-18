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

  return Response.json({
    data: {
      batch: { ...batch, currentCount: Number(pop[0]?.current_count ?? batch.initialCount) },
      weights: weights.map((w) => ({ ...w, weightKg: Number(w.weightKg) })),
      mortalities,
    },
  });
});
