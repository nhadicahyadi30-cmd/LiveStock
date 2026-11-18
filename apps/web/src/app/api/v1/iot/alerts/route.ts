import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/iot/alerts -> riwayat alarm terbaru (yang masih terbuka di atas)
export const GET = tenantRoute({ permission: "iot.read" }, async (c) => {
  const devices = await c.tx.device.findMany({ where: c.allowedFarmIds ? { farmId: { in: c.allowedFarmIds } } : {}, select: { id: true, name: true } });
  const name = new Map(devices.map((d) => [d.id, d.name]));
  const rows = await c.tx.alertEvent.findMany({ where: { deviceId: { in: devices.map((d) => d.id) } }, orderBy: { triggeredAt: "desc" }, take: 50 });
  return Response.json({ data: rows.map((r) => ({ ...r, deviceName: name.get(r.deviceId) ?? "-" })) });
});
