import { financeEntryCreate, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { assertBatchExists, requireFullAccess } from "@/server/finance";
import { pageOf, parsePagination } from "@/server/pagination";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/finance/entries?kind=&batchId=&limit=&cursor=
export const GET = tenantRoute({ permission: "finance.read" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url);
  const kind = (["INCOME", "EXPENSE"] as const).find((k) => k === url.searchParams.get("kind"));
  const batchIdRaw = url.searchParams.get("batchId");
  const rows = await c.tx.financeEntry.findMany({
    where: { ...(kind ? { kind } : {}), ...(batchIdRaw ? { batchId: uuid.parse(batchIdRaw) } : {}) },
    orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = pageOf(rows, limit);
  return Response.json({ data: page.data.map((r) => ({ ...r, amount: Number(r.amount) })), nextCursor: page.nextCursor });
});

// POST /api/v1/finance/entries
export const POST = tenantRoute({ permission: "finance.manage" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const input = financeEntryCreate.parse(await c.req.json());
  if (input.batchId) await assertBatchExists(c.tx, c.organizationId, input.batchId);
  if (input.clientId) {
    const ex = await c.tx.financeEntry.findUnique({ where: { organizationId_clientId: { organizationId: c.organizationId, clientId: input.clientId } } });
    if (ex) return Response.json({ data: { id: ex.id } }, { status: 200 });
  }
  const row = await c.tx.financeEntry.create({ data: { ...input, organizationId: c.organizationId, recordedBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "finance_entry.create", entityType: "finance_entry", entityId: row.id, after: { kind: row.kind, category: row.category, amount: Number(row.amount) } });
  return Response.json({ data: { ...row, amount: Number(row.amount) } }, { status: 201 });
});
