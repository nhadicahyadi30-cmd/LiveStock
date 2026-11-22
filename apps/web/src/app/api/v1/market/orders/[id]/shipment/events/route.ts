import { shipmentEventCreate, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/market/orders/:id/shipment/events -> penjual menambah titik pelacakan (tidak bisa diubah setelahnya)
export const POST = tenantRoute<{ id: string }>({ permission: "market.manage" }, async (c) => {
  const orderId = uuid.parse(c.params.id);
  const input = shipmentEventCreate.parse(await c.req.json());
  const sh = await c.tx.marketShipment.findUnique({ where: { orderId } });
  if (!sh) throw new ApiError(404, "NOT_FOUND", "Pengiriman belum dibuat");
  if (sh.sellerOrgId !== c.organizationId) throw new ApiError(403, "FORBIDDEN", "Hanya penjual yang menambah pelacakan");
  const o = await c.tx.marketOrder.findUnique({ where: { id: orderId } });
  if (!o || o.status !== "SHIPPED") throw new ApiError(409, "INVALID_TRANSITION", "Pelacakan hanya untuk pesanan yang sedang dikirim");
  const ev = await c.tx.marketShipmentEvent.create({ data: { ...input, shipmentId: sh.id, sellerOrgId: sh.sellerOrgId, buyerOrgId: sh.buyerOrgId, createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "market_shipment.event", entityType: "market_shipment", entityId: sh.id, after: { status: input.status } });
  return Response.json({ data: { id: ev.id } }, { status: 201 });
});
