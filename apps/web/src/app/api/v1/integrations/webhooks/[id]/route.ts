import { uuid, webhookPatch } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// PATCH /api/v1/integrations/webhooks/:id -> aktif/nonaktif atau ganti daftar event
export const PATCH = tenantRoute<{ id: string }>({ permission: "members.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const input = webhookPatch.parse(await c.req.json());
  const upd = await c.tx.webhookEndpoint.updateMany({ where: { id }, data: input });
  if (upd.count === 0) throw new ApiError(404, "NOT_FOUND", "Endpoint tidak ditemukan");
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "webhook.update", entityType: "webhook_endpoint", entityId: id, after: input });
  return Response.json({ data: { id } });
});

// DELETE /api/v1/integrations/webhooks/:id
export const DELETE = tenantRoute<{ id: string }>({ permission: "members.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const del = await c.tx.webhookEndpoint.deleteMany({ where: { id } });
  if (del.count === 0) throw new ApiError(404, "NOT_FOUND", "Endpoint tidak ditemukan");
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "webhook.delete", entityType: "webhook_endpoint", entityId: id });
  return Response.json({ data: { id } });
});
