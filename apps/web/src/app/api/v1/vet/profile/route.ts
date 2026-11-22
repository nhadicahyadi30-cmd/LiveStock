import { vetProfileUpsert } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/vet/profile -> profil dokter hewan organisasi aktif (null bila belum mendaftar)
export const GET = tenantRoute({ permission: "records.read" }, async (c) => {
  return Response.json({ data: await c.tx.vetProfile.findUnique({ where: { orgId: c.organizationId } }) });
});

// PUT /api/v1/vet/profile -> mendaftar / mengubah profil dokter hewan (hanya OWNER/MANAGER lewat market.manage)
export const PUT = tenantRoute({ permission: "market.manage" }, async (c) => {
  const input = vetProfileUpsert.parse(await c.req.json());
  const data = await c.tx.vetProfile.upsert({ where: { orgId: c.organizationId }, update: input, create: { ...input, orgId: c.organizationId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "vet_profile.upsert", entityType: "vet_profile", entityId: c.organizationId, after: { displayName: data.displayName } });
  return Response.json({ data });
});
