import { vendorProfileUpsert } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/market/profile -> profil toko organisasi aktif (null bila belum dibuat)
export const GET = tenantRoute({ permission: "market.read" }, async (c) => {
  const data = await c.tx.vendorProfile.findUnique({ where: { orgId: c.organizationId } });
  return Response.json({ data });
});

// PUT /api/v1/market/profile -> membuat/mengubah profil toko (izin market.manage)
export const PUT = tenantRoute({ permission: "market.manage" }, async (c) => {
  const input = vendorProfileUpsert.parse(await c.req.json());
  const data = await c.tx.vendorProfile.upsert({ where: { orgId: c.organizationId }, update: input, create: { ...input, orgId: c.organizationId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "vendor_profile.upsert", entityType: "vendor_profile", entityId: c.organizationId, after: { displayName: data.displayName } });
  return Response.json({ data });
});
