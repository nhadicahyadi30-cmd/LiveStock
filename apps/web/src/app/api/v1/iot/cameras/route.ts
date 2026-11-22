import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/iot/cameras -> perangkat yang pernah mengirim foto, dengan foto terbaru dan 12 foto sebelumnya
export const GET = tenantRoute({ permission: "iot.read" }, async (c) => {
  const grouped = await c.tx.cameraSnapshot.groupBy({ by: ["deviceId"], _max: { capturedAt: true }, _count: { _all: true } });
  const devices = await c.tx.device.findMany({ where: { id: { in: grouped.map((g) => g.deviceId) }, ...(c.allowedFarmIds ? { farmId: { in: c.allowedFarmIds } } : {}) } });
  const out = [];
  for (const d of devices) {
    const recent = await c.tx.cameraSnapshot.findMany({ where: { deviceId: d.id }, orderBy: { capturedAt: "desc" }, take: 13, select: { id: true, capturedAt: true, sizeBytes: true } });
    out.push({ id: d.id, name: d.name, location: d.locationName, status: d.status, total: grouped.find((g) => g.deviceId === d.id)?._count._all ?? 0, snapshots: recent });
  }
  return Response.json({ data: out });
});
