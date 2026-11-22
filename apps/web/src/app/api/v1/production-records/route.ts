import { PRODUCTION_UNIT, productionRecordCreate, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { pageOf, parsePagination } from "@/server/pagination";
import { resolveTarget } from "@/server/record-target";
import { emitEvent } from "@/server/webhooks";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/production-records?batchId=&limit=&cursor=  (izin records.read)
export const GET = tenantRoute({ permission: "records.read" }, async (c) => {
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url);
  const batchIdRaw = url.searchParams.get("batchId");
  const batchId = batchIdRaw ? uuid.parse(batchIdRaw) : undefined;
  const farmScope = c.allowedFarmIds ? { batchId: { in: (await c.tx.livestockBatch.findMany({ where: { farmId: { in: c.allowedFarmIds } }, select: { id: true } })).map((b) => b.id) } } : {};

  const rows = await c.tx.productionRecord.findMany({
    where: { ...farmScope, ...(batchId ? { batchId } : {}) },
    orderBy: { id: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = pageOf(rows, limit);
  return Response.json({ data: page.data.map((r) => ({ ...r, quantity: Number(r.quantity) })), nextCursor: page.nextCursor });
});

// POST /api/v1/production-records  (izin records.create). Satuan ditetapkan server dari jenis produksi.
export const POST = tenantRoute({ permission: "records.create" }, async (c) => {
  const input = productionRecordCreate.parse(await c.req.json());
  await resolveTarget(c, { batchId: input.batchId });

  if (input.clientId) {
    const existing = await c.tx.productionRecord.findUnique({ where: { organizationId_clientId: { organizationId: c.organizationId, clientId: input.clientId } } });
    if (existing) return Response.json({ data: existing }, { status: 200 });
  }

  const record = await c.tx.productionRecord.create({
    data: { ...input, unit: PRODUCTION_UNIT[input.kind], organizationId: c.organizationId, recordedBy: c.userId },
  });
  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "production_record.create", entityType: "production_record", entityId: record.id, after: { kind: input.kind, quantity: input.quantity } },
  );
  await emitEvent(c.tx, c.organizationId, "production_record.created", { id: record.id, batchId: record.batchId, kind: record.kind, quantity: Number(record.quantity), unit: record.unit });
  return Response.json({ data: record }, { status: 201 });
});
