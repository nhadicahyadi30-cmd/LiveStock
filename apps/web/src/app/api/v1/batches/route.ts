import { batchCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { assertFarmAccess } from "@/server/farm-access";
import { pageOf, parsePagination } from "@/server/pagination";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/batches?farmId=&status=&limit=&cursor=  (izin livestock.read)
export const GET = tenantRoute({ permission: "livestock.read" }, async (c) => {
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url);
  const farmId = url.searchParams.get("farmId") ?? undefined;
  if (farmId) assertFarmAccess(c, farmId);
  const status = url.searchParams.get("status");

  const rows = await c.tx.livestockBatch.findMany({
    where: {
      ...(farmId ? { farmId } : c.allowedFarmIds ? { farmId: { in: c.allowedFarmIds } } : {}),
      ...(status === "ACTIVE" || status === "CLOSED" ? { status } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = pageOf(rows, limit);

  // Populasi saat ini dihitung database (view batch_population, tunduk pada RLS).
  const ids = page.data.map((b) => b.id);
  const pops = ids.length
    ? await c.tx.$queryRaw<{ batch_id: string; current_count: bigint }[]>`
        SELECT batch_id, current_count FROM batch_population WHERE batch_id = ANY(${ids}::uuid[])`
    : [];
  const byId = new Map(pops.map((r) => [r.batch_id, Number(r.current_count)]));

  return Response.json({
    data: page.data.map((b) => ({ ...b, currentCount: byId.get(b.id) ?? b.initialCount })),
    nextCursor: page.nextCursor,
  });
});

// POST /api/v1/batches  (izin livestock.write). Idempoten bila clientId sama dikirim ulang.
export const POST = tenantRoute({ permission: "livestock.write" }, async (c) => {
  const input = batchCreate.parse(await c.req.json());
  assertFarmAccess(c, input.farmId);

  if (input.clientId) {
    const existing = await c.tx.livestockBatch.findUnique({
      where: { organizationId_clientId: { organizationId: c.organizationId, clientId: input.clientId } },
    });
    if (existing) return Response.json({ data: existing }, { status: 200 });
  }

  const batch = await c.tx.livestockBatch.create({
    data: { ...input, organizationId: c.organizationId, createdBy: c.userId },
  });

  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "batch.create", entityType: "livestock_batch", entityId: batch.id, after: { code: batch.code, initialCount: batch.initialCount } },
  );
  return Response.json({ data: batch }, { status: 201 });
});
