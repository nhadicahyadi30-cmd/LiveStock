import { uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { assertFarmAccess } from "@/server/farm-access";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/iot/snapshots/:id -> gambar (hanya untuk anggota organisasi pemilik; sesi diperlukan)
export const GET = tenantRoute<{ id: string }>({ permission: "iot.read" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const s = await c.tx.cameraSnapshot.findUnique({ where: { id } });
  if (!s) throw new ApiError(404, "NOT_FOUND", "Foto tidak ditemukan");
  const dev = await c.tx.device.findUnique({ where: { id: s.deviceId } });
  if (!dev) throw new ApiError(404, "NOT_FOUND", "Foto tidak ditemukan");
  assertFarmAccess(c, dev.farmId);
  return new Response(new Uint8Array(s.data), { headers: { "content-type": s.contentType, "content-length": String(s.sizeBytes), "cache-control": "private, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
});

// DELETE /api/v1/iot/snapshots/:id
export const DELETE = tenantRoute<{ id: string }>({ permission: "iot.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const s = await c.tx.cameraSnapshot.findUnique({ where: { id }, select: { id: true, deviceId: true } });
  if (!s) throw new ApiError(404, "NOT_FOUND", "Foto tidak ditemukan");
  const dev = await c.tx.device.findUnique({ where: { id: s.deviceId } });
  if (dev) assertFarmAccess(c, dev.farmId);
  await c.tx.cameraSnapshot.delete({ where: { id } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "camera_snapshot.delete", entityType: "camera_snapshot", entityId: id });
  return Response.json({ data: { id } });
});
