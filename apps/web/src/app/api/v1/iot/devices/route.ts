import { deviceCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { assertFarmAccess } from "@/server/farm-access";
import { ApiError } from "@/server/errors";
import { isOnline, newDeviceToken } from "@/server/iot";
import { assertWithinPlan } from "@/server/plan-guard";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/iot/devices -> perangkat + nilai terakhir tiap metrik + alarm yang sedang terbuka
export const GET = tenantRoute({ permission: "iot.read" }, async (c) => {
  const devices = await c.tx.device.findMany({ where: c.allowedFarmIds ? { farmId: { in: c.allowedFarmIds } } : {}, orderBy: { createdAt: "asc" } });
  const ids = devices.map((d) => d.id);
  const [latest, openAlerts, farms] = await Promise.all([
    ids.length ? c.tx.$queryRaw<{ device_id: string; metric: string; value: number; recorded_at: Date }[]>`
      SELECT DISTINCT ON (device_id, metric) device_id, metric, value, recorded_at
      FROM sensor_readings WHERE device_id = ANY(${ids}::uuid[]) AND recorded_at > now() - interval '3 days'
      ORDER BY device_id, metric, recorded_at DESC` : Promise.resolve([]),
    c.tx.alertEvent.findMany({ where: { deviceId: { in: ids }, resolvedAt: null } }),
    c.tx.farm.findMany({ select: { id: true, name: true } }),
  ]);
  const farmName = new Map(farms.map((f) => [f.id, f.name]));
  return Response.json({
    data: devices.map((d) => ({
      id: d.id, name: d.name, locationName: d.locationName, status: d.status, farmId: d.farmId, farmName: farmName.get(d.farmId) ?? "-",
      tokenPrefix: d.tokenPrefix, lastSeenAt: d.lastSeenAt, online: d.status === "ACTIVE" && isOnline(d.lastSeenAt),
      latest: latest.filter((l) => l.device_id === d.id).map((l) => ({ metric: l.metric, value: l.value, at: l.recorded_at })),
      openAlerts: openAlerts.filter((a) => a.deviceId === d.id).map((a) => ({ id: a.id, name: a.ruleName, metric: a.metric, value: a.value })),
    })),
  });
});

// POST /api/v1/iot/devices -> mendaftarkan perangkat. Token HANYA ditampilkan sekali di respons ini.
export const POST = tenantRoute({ permission: "iot.manage" }, async (c) => {
  const input = deviceCreate.parse(await c.req.json());
  await assertWithinPlan(c.tx, c.organizationId, "devices");
  assertFarmAccess(c, input.farmId);
  const farm = await c.tx.farm.findUnique({ where: { organizationId_id: { organizationId: c.organizationId, id: input.farmId } } });
  if (!farm) throw new ApiError(404, "NOT_FOUND", "Farm tidak ditemukan");
  const { token, hash, prefix } = newDeviceToken();
  const d = await c.tx.device.create({ data: { ...input, organizationId: c.organizationId, tokenHash: hash, tokenPrefix: prefix, createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "device.create", entityType: "device", entityId: d.id, after: { name: d.name } });
  return Response.json({ data: { id: d.id, name: d.name, token } }, { status: 201 });
});
