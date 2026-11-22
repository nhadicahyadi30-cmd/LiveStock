import { uuid } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { flushOrg } from "@/server/webhooks";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/integrations/webhooks/:id/test -> antrekan event "ping" ke endpoint ini
export const POST = tenantRoute<{ id: string }>({ permission: "members.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const ep = await c.tx.webhookEndpoint.findUnique({ where: { id } });
  if (!ep) throw new ApiError(404, "NOT_FOUND", "Endpoint tidak ditemukan");
  const d = await c.tx.webhookDelivery.create({ data: { organizationId: c.organizationId, endpointId: id, event: "ping", payload: { event: "ping", createdAt: new Date().toISOString(), data: { message: "Uji webhook Nusa Ternak" } } } });
  const t = setTimeout(() => { void flushOrg(c.organizationId, d.id).catch(() => undefined); }, 500);
  (t as { unref?: () => void }).unref?.();
  return Response.json({ data: { deliveryId: d.id } }, { status: 202 });
});
