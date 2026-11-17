import { farmCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { pageOf, parsePagination } from "@/server/pagination";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/farms?limit=&cursor=  -> farm yang boleh diakses pengguna (izin farm.read)
export const GET = tenantRoute({ permission: "farm.read" }, async (c) => {
  const { limit, cursor } = parsePagination(new URL(c.req.url));

  const rows = await c.tx.farm.findMany({
    where: c.allowedFarmIds ? { id: { in: c.allowedFarmIds } } : {},
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  return Response.json(pageOf(rows, limit));
});

// POST /api/v1/farms  -> membuat farm (izin farm.write)
export const POST = tenantRoute({ permission: "farm.write" }, async (c) => {
  const input = farmCreate.parse(await c.req.json());

  const farm = await c.tx.farm.create({
    data: {
      ...input,
      organizationId: c.organizationId, // dari sesi dan keanggotaan, bukan dari body
      createdBy: c.userId,
    },
  });

  // Anggota yang aksesnya dibatasi per farm otomatis mendapat akses ke farm yang ia buat.
  if (c.allowedFarmIds) {
    await c.tx.membershipFarm.create({
      data: { organizationId: c.organizationId, membershipId: c.membershipId, farmId: farm.id },
    });
  }

  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "farm.create", entityType: "farm", entityId: farm.id, after: { name: farm.name, code: farm.code } },
  );

  return Response.json({ data: farm }, { status: 201 });
});
