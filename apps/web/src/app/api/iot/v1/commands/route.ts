import { withTenant } from "@sl/database";
import { apiRoute } from "@/server/errors";
import { authenticateDevice } from "@/server/iot";

export const dynamic = "force-dynamic";

// GET /api/iot/v1/commands -> perintah yang menunggu untuk perangkat ini; otomatis ditandai SENT.
// Perangkat membalas lewat POST /commands/:id/ack setelah menjalankannya.
export function GET(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const d = await authenticateDevice(req);
    const list = await withTenant({ organizationId: d.organizationId, userId: d.createdBy }, async (tx) => {
      const pending = await tx.deviceCommand.findMany({ where: { deviceId: d.id, status: "PENDING" }, orderBy: { id: "asc" }, take: 20 });
      if (pending.length > 0) await tx.deviceCommand.updateMany({ where: { id: { in: pending.map((p) => p.id) }, status: "PENDING" }, data: { status: "SENT", sentAt: new Date() } });
      await tx.device.update({ where: { id: d.id }, data: { lastSeenAt: new Date() } });
      return pending;
    });
    return Response.json({ data: list.map((c) => ({ id: c.id, command: c.command, payload: c.payload })) });
  });
}
