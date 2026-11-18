import { feedRecordCreate, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { pageOf, parsePagination } from "@/server/pagination";
import { resolveTarget } from "@/server/record-target";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/feed-records?batchId=&limit=&cursor=  (izin records.read)
export const GET = tenantRoute({ permission: "records.read" }, async (c) => {
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url);
  const batchIdRaw = url.searchParams.get("batchId");
  const batchId = batchIdRaw ? uuid.parse(batchIdRaw) : undefined;
  const farmScope = c.allowedFarmIds ? { batchId: { in: (await c.tx.livestockBatch.findMany({ where: { farmId: { in: c.allowedFarmIds } }, select: { id: true } })).map((b) => b.id) } } : {};

  const rows = await c.tx.feedRecord.findMany({
    where: { ...farmScope, ...(batchId ? { batchId } : {}) },
    orderBy: { id: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const types = await c.tx.feedType.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.feedTypeId))] } } });
  const name = new Map(types.map((t) => [t.id, t.name]));
  const page = pageOf(rows, limit);
  return Response.json({
    data: page.data.map((r) => ({ ...r, quantityKg: Number(r.quantityKg), costTotal: r.costTotal === null ? null : Number(r.costTotal), feedName: name.get(r.feedTypeId) ?? "-" })),
    nextCursor: page.nextCursor,
  });
});

// POST /api/v1/feed-records  (izin records.create). Jenis pakan dicari lewat nama, dibuat bila belum ada.
export const POST = tenantRoute({ permission: "records.create" }, async (c) => {
  const input = feedRecordCreate.parse(await c.req.json());
  await resolveTarget(c, { batchId: input.batchId });

  if (input.clientId) {
    const existing = await c.tx.feedRecord.findUnique({ where: { organizationId_clientId: { organizationId: c.organizationId, clientId: input.clientId } } });
    if (existing) return Response.json({ data: existing }, { status: 200 });
  }

  const feedType = await c.tx.feedType.upsert({
    where: { organizationId_name: { organizationId: c.organizationId, name: input.feedName } },
    update: {},
    create: { organizationId: c.organizationId, name: input.feedName, createdBy: c.userId },
  });

  const { feedName: _feedName, ...rest } = input;
  const record = await c.tx.feedRecord.create({
    data: { ...rest, feedTypeId: feedType.id, organizationId: c.organizationId, recordedBy: c.userId },
  });
  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "feed_record.create", entityType: "feed_record", entityId: record.id, after: { feed: feedType.name, quantityKg: input.quantityKg } },
  );
  return Response.json({ data: record }, { status: 201 });
});
