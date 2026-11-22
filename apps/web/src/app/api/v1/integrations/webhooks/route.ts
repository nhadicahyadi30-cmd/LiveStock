import { WEBHOOK_EVENTS, webhookCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { newWebhookSecret, webhookUrlCheck } from "@/server/webhooks";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/integrations/webhooks -> endpoint + 30 pengiriman terakhir
export const GET = tenantRoute({ permission: "members.manage" }, async (c) => {
  const [eps, deliveries] = await Promise.all([
    c.tx.webhookEndpoint.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    c.tx.webhookDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return Response.json({ data: {
    events: WEBHOOK_EVENTS,
    endpoints: eps.map((e) => ({ id: e.id, url: e.url, events: e.events, active: e.active, createdAt: e.createdAt })),
    deliveries: deliveries.map((d) => ({ id: d.id, endpointId: d.endpointId, event: d.event, status: d.status, attempts: d.attempts, responseStatus: d.responseStatus, lastError: d.lastError, createdAt: d.createdAt })),
  } });
});

// POST /api/v1/integrations/webhooks -> membuat endpoint. Rahasia penanda tangan HANYA ditampilkan sekali.
export const POST = tenantRoute({ permission: "members.manage" }, async (c) => {
  const input = webhookCreate.parse(await c.req.json());
  const check = webhookUrlCheck(input.url);
  if (!check.ok) throw new ApiError(422, "UNSAFE_URL", check.reason);
  if ((await c.tx.webhookEndpoint.count()) >= 10) throw new ApiError(409, "LIMIT", "Maksimal 10 endpoint webhook");
  const secret = newWebhookSecret();
  const row = await c.tx.webhookEndpoint.create({ data: { organizationId: c.organizationId, url: input.url, events: input.events, secret, createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "webhook.create", entityType: "webhook_endpoint", entityId: row.id, after: { url: input.url, events: input.events } });
  return Response.json({ data: { id: row.id, secret } }, { status: 201 });
});
