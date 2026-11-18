import { alertRuleUpdate, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { loadDevice } from "@/server/iot";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

async function ruleFor(c: Parameters<typeof loadDevice>[0], id: string) {
  const r = await c.tx.alertRule.findUnique({ where: { id } });
  if (!r) throw new ApiError(404, "NOT_FOUND", "Aturan tidak ditemukan");
  await loadDevice(c, r.deviceId);
  return r;
}

export const PATCH = tenantRoute<{ id: string }>({ permission: "iot.manage" }, async (c) => {
  const r = await ruleFor(c, uuid.parse(c.params.id));
  const input = alertRuleUpdate.parse(await c.req.json());
  await c.tx.alertRule.update({ where: { id: r.id }, data: input });
  if (input.enabled === false) await c.tx.alertEvent.updateMany({ where: { ruleId: r.id, resolvedAt: null }, data: { resolvedAt: new Date() } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "alert_rule.update", entityType: "alert_rule", entityId: r.id, after: input });
  return Response.json({ data: { id: r.id } });
});

export const DELETE = tenantRoute<{ id: string }>({ permission: "iot.manage" }, async (c) => {
  const r = await ruleFor(c, uuid.parse(c.params.id));
  await c.tx.alertEvent.updateMany({ where: { ruleId: r.id, resolvedAt: null }, data: { resolvedAt: new Date() } });
  await c.tx.alertRule.delete({ where: { id: r.id } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "alert_rule.delete", entityType: "alert_rule", entityId: r.id, before: { name: r.name } });
  return Response.json({ data: { id: r.id } });
});
