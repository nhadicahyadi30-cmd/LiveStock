import { animalCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { assertFarmAccess } from "@/server/farm-access";
import { pageOf, parsePagination } from "@/server/pagination";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/animals?farmId=&status=&limit=&cursor=  (izin livestock.read)
export const GET = tenantRoute({ permission: "livestock.read" }, async (c) => {
  const url = new URL(c.req.url);
  const { limit, cursor } = parsePagination(url);
  const farmId = url.searchParams.get("farmId") ?? undefined;
  if (farmId) assertFarmAccess(c, farmId);
  const status = url.searchParams.get("status");

  const rows = await c.tx.animal.findMany({
    where: {
      ...(farmId ? { farmId } : c.allowedFarmIds ? { farmId: { in: c.allowedFarmIds } } : {}),
      ...(status === "ACTIVE" ? { status } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return Response.json(pageOf(rows, limit));
});

// POST /api/v1/animals  (izin livestock.write). Idempoten bila clientId sama dikirim ulang.
export const POST = tenantRoute({ permission: "livestock.write" }, async (c) => {
  const input = animalCreate.parse(await c.req.json());
  assertFarmAccess(c, input.farmId);

  if (input.clientId) {
    const existing = await c.tx.animal.findUnique({
      where: { organizationId_clientId: { organizationId: c.organizationId, clientId: input.clientId } },
    });
    if (existing) return Response.json({ data: existing }, { status: 200 });
  }

  const animal = await c.tx.animal.create({
    data: { ...input, organizationId: c.organizationId, createdBy: c.userId },
  });

  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "animal.create", entityType: "animal", entityId: animal.id, after: { code: animal.code } },
  );
  return Response.json({ data: animal }, { status: 201 });
});
