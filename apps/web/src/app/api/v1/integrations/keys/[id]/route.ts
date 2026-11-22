import { uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// DELETE /api/v1/integrations/keys/:id -> mencabut kunci (langsung tidak berlaku)
export const DELETE = tenantRoute<{ id: string }>({ permission: "members.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const upd = await c.tx.apiKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (upd.count === 0) throw new ApiError(404, "NOT_FOUND", "Kunci tidak ditemukan atau sudah dicabut");
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "api_key.revoke", entityType: "api_key", entityId: id });
  return Response.json({ data: { id } });
});
