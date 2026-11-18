import { deviceUpdate, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { isOnline, loadDevice } from "@/server/iot";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

export const GET = tenantRoute<{ id: string }>({ permission: "iot.read" }, async (c) => {
  const d = await loadDevice(c, uuid.parse(c.params.id));
  const metrics = await c.tx.$queryRaw<{ metric: string }[]>`SELECT DISTINCT metric FROM sensor_readings WHERE device_id = ${d.id}::uuid AND recorded_at > now() - interval '30 days' ORDER BY metric`;
  return Response.json({ data: { id: d.id, name: d.name, locationName: d.locationName, status: d.status, farmId: d.farmId, tokenPrefix: d.tokenPrefix, lastSeenAt: d.lastSeenAt, online: d.status === "ACTIVE" && isOnline(d.lastSeenAt), metrics: metrics.map((m) => m.metric) } });
});

// PATCH /api/v1/iot/devices/:id -> ubah nama, lokasi, atau nonaktifkan/aktifkan
export const PATCH = tenantRoute<{ id: string }>({ permission: "iot.manage" }, async (c) => {
  const d = await loadDevice(c, uuid.parse(c.params.id));
  const input = deviceUpdate.parse(await c.req.json());
  await c.tx.device.update({ where: { id: d.id }, data: input });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "device.update", entityType: "device", entityId: d.id, after: input });
  return Response.json({ data: { id: d.id } });
});
