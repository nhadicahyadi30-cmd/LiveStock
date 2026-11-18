import { withTenant } from "@sl/database";
import { commandAck, uuid } from "@sl/validation";
import { ApiError, apiRoute } from "@/server/errors";
import { authenticateDevice } from "@/server/iot";

export const dynamic = "force-dynamic";

// POST /api/iot/v1/commands/:id/ack  { "result": "ok" }
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return apiRoute(req, async () => {
    const d = await authenticateDevice(req);
    const id = uuid.parse((await ctx.params).id);
    const { result } = commandAck.parse(await req.json().catch(() => ({})));
    const n = await withTenant({ organizationId: d.organizationId, userId: d.createdBy }, (tx) =>
      tx.deviceCommand.updateMany({ where: { id, deviceId: d.id, status: { in: ["PENDING", "SENT"] } }, data: { status: "ACKED", ackedAt: new Date(), result } }),
    );
    if (n.count === 0) throw new ApiError(404, "NOT_FOUND", "Perintah tidak ditemukan atau sudah dikonfirmasi");
    return Response.json({ data: { id, status: "ACKED" } });
  });
}
