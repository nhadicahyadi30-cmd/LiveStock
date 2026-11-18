import { commandCreate, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { loadDevice } from "@/server/iot";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

export const GET = tenantRoute<{ id: string }>({ permission: "iot.read" }, async (c) => {
  const d = await loadDevice(c, uuid.parse(c.params.id));
  const rows = await c.tx.deviceCommand.findMany({ where: { deviceId: d.id }, orderBy: { id: "desc" }, take: 20 });
  return Response.json({ data: rows });
});

// POST /api/v1/iot/devices/:id/commands -> antre perintah (mis. feeder_on, fan_off); perangkat mengambilnya lewat polling
export const POST = tenantRoute<{ id: string }>({ permission: "iot.manage" }, async (c) => {
  const d = await loadDevice(c, uuid.parse(c.params.id));
  if (d.status !== "ACTIVE") throw new ApiError(409, "DEVICE_DISABLED", "Perangkat dinonaktifkan");
  const input = commandCreate.parse(await c.req.json());
  const pending = await c.tx.deviceCommand.count({ where: { deviceId: d.id, status: { in: ["PENDING", "SENT"] } } });
  if (pending >= 20) throw new ApiError(429, "QUEUE_FULL", "Terlalu banyak perintah yang belum dikonfirmasi perangkat");
  const row = await c.tx.deviceCommand.create({ data: { organizationId: c.organizationId, deviceId: d.id, command: input.command, payload: input.payload ?? undefined, createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "device.command", entityType: "device", entityId: d.id, after: { command: input.command } });
  return Response.json({ data: row }, { status: 201 });
});
