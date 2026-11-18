import { uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { loadDevice, newDeviceToken } from "@/server/iot";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/iot/devices/:id/token -> membuat token baru; token lama langsung tidak berlaku
export const POST = tenantRoute<{ id: string }>({ permission: "iot.manage" }, async (c) => {
  const d = await loadDevice(c, uuid.parse(c.params.id));
  const { token, hash, prefix } = newDeviceToken();
  await c.tx.device.update({ where: { id: d.id }, data: { tokenHash: hash, tokenPrefix: prefix } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "device.rotate_token", entityType: "device", entityId: d.id });
  return Response.json({ data: { token } });
});
