import { healthRecordCreate, healthKinds, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { pageOf, parsePagination } from "@/server/pagination";
import { resolveTarget } from "@/server/record-target";
import { emitEvent } from "@/server/webhooks";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/health-records?kind=&batchId=&status=&limit=&cursor=  (izin records.read)
export const GET = tenantRoute({ permission: "records.read" }, async (c) => {
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url);
  const kindRaw = url.searchParams.get("kind");
  const statusRaw = url.searchParams.get("status");
  const batchIdRaw = url.searchParams.get("batchId");
  const kind = healthKinds.find((k) => k === kindRaw);
  const status = (["PLANNED", "ACTIVE", "DONE"] as const).find((s) => s === statusRaw);
  const batchId = batchIdRaw ? uuid.parse(batchIdRaw) : undefined;
  const farmScope = c.allowedFarmIds ? { batchId: { in: (await c.tx.livestockBatch.findMany({ where: { farmId: { in: c.allowedFarmIds } }, select: { id: true } })).map((b) => b.id) } } : {};

  const rows = await c.tx.healthRecord.findMany({
    where: { ...farmScope, ...(kind ? { kind } : {}), ...(status ? { status } : {}), ...(batchId ? { batchId } : {}) },
    orderBy: { id: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = pageOf(rows, limit);
  return Response.json({ data: page.data.map((r) => ({ ...r, cost: r.cost === null ? null : Number(r.cost) })), nextCursor: page.nextCursor });
});

// POST /api/v1/health-records  (izin records.create)
export const POST = tenantRoute({ permission: "records.create" }, async (c) => {
  const input = healthRecordCreate.parse(await c.req.json());
  await resolveTarget(c, { batchId: input.batchId });

  if (input.clientId) {
    const existing = await c.tx.healthRecord.findUnique({ where: { organizationId_clientId: { organizationId: c.organizationId, clientId: input.clientId } } });
    if (existing) return Response.json({ data: existing }, { status: 200 });
  }

  const { done, ...rest } = input;
  const isDone = done === true;
  const record = await c.tx.healthRecord.create({
    data: { ...rest, status: isDone ? "DONE" : input.kind === "VACCINATION" ? "PLANNED" : "ACTIVE", doneOn: isDone ? input.eventOn : null, organizationId: c.organizationId, recordedBy: c.userId },
  });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "health_record.create", entityType: "health_record", entityId: record.id, after: { kind: record.kind, title: record.title } });
  await emitEvent(c.tx, c.organizationId, "health_record.created", { id: record.id, kind: record.kind, title: record.title, status: record.status });
  return Response.json({ data: record }, { status: 201 });
});
