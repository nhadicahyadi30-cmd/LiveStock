import { weightRecordCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { resolveTarget } from "@/server/record-target";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/weight-records  (izin records.create). Idempoten lewat clientId.
export const POST = tenantRoute({ permission: "records.create" }, async (c) => {
  const input = weightRecordCreate.parse(await c.req.json());
  await resolveTarget(c, input);

  if (input.clientId) {
    const existing = await c.tx.weightRecord.findUnique({
      where: { organizationId_clientId: { organizationId: c.organizationId, clientId: input.clientId } },
    });
    if (existing) return Response.json({ data: existing }, { status: 200 });
  }

  const record = await c.tx.weightRecord.create({
    data: { ...input, organizationId: c.organizationId, recordedBy: c.userId },
  });
  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "weight_record.create", entityType: "weight_record", entityId: record.id },
  );
  return Response.json({ data: record }, { status: 201 });
});
