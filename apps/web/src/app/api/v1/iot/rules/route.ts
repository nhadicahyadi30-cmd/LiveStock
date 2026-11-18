import { alertRuleCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { loadDevice } from "@/server/iot";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

export const GET = tenantRoute({ permission: "iot.read" }, async (c) => {
  const devices = await c.tx.device.findMany({ where: c.allowedFarmIds ? { farmId: { in: c.allowedFarmIds } } : {}, select: { id: true } });
  const rows = await c.tx.alertRule.findMany({ where: { deviceId: { in: devices.map((d) => d.id) } }, orderBy: { createdAt: "desc" }, take: 200 });
  return Response.json({ data: rows });
});

// POST /api/v1/iot/rules -> alarm: notifikasi ke pemilik/manajer saat nilai melewati batas, selesai saat kembali normal
export const POST = tenantRoute({ permission: "iot.manage" }, async (c) => {
  const input = alertRuleCreate.parse(await c.req.json());
  await loadDevice(c, input.deviceId);
  const row = await c.tx.alertRule.create({ data: { ...input, organizationId: c.organizationId, createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "alert_rule.create", entityType: "alert_rule", entityId: row.id, after: { name: row.name } });
  return Response.json({ data: row }, { status: 201 });
});
