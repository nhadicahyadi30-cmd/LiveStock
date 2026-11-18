import { mortalityRecordCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { resolveTarget } from "@/server/record-target";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/mortality-records  (izin records.create).
// Untuk batch, populasi berkurang otomatis lewat view batch_population; trigger database menolak populasi negatif.
export const POST = tenantRoute({ permission: "records.create" }, async (c) => {
  const input = mortalityRecordCreate.parse(await c.req.json());
  await resolveTarget(c, input);

  if (input.clientId) {
    const existing = await c.tx.mortalityRecord.findUnique({
      where: { organizationId_clientId: { organizationId: c.organizationId, clientId: input.clientId } },
    });
    if (existing) return Response.json({ data: existing }, { status: 200 });
  }

  if (input.batchId) {
    const pop = await c.tx.$queryRaw<{ current_count: bigint }[]>`SELECT current_count FROM batch_population WHERE batch_id = ${input.batchId}::uuid`;
    const current = Number(pop[0]?.current_count ?? 0);
    if (input.count > current) throw new ApiError(409, "POPULATION_NEGATIVE", `Jumlah melebihi populasi saat ini (${current} ekor)`);
  }

  const record = await c.tx.mortalityRecord.create({
    data: { ...input, organizationId: c.organizationId, recordedBy: c.userId },
  });

  if (input.animalId) {
    await c.tx.animal.update({ where: { id: input.animalId }, data: { status: "DEAD" } });
  }

  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "mortality_record.create", entityType: "mortality_record", entityId: record.id, after: { count: record.count, cause: record.cause } },
  );
  return Response.json({ data: record }, { status: 201 });
});
