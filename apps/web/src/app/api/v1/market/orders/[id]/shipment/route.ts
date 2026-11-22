import { shipmentUpsert, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { notifyOrg } from "@/server/notify";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/market/orders/:id/shipment -> pengiriman + riwayat (pembeli atau penjual pesanan)
export const GET = tenantRoute<{ id: string }>({ permission: "market.read" }, async (c) => {
  const orderId = uuid.parse(c.params.id);
  const sh = await c.tx.marketShipment.findUnique({ where: { orderId } });
  if (!sh) return Response.json({ data: null });
  const events = await c.tx.marketShipmentEvent.findMany({ where: { shipmentId: sh.id }, orderBy: { createdAt: "asc" } });
  return Response.json({ data: { ...sh, fee: Number(sh.fee), etaOn: sh.etaOn?.toISOString().slice(0, 10) ?? null, events: events.map((e) => ({ id: e.id, status: e.status, location: e.location, note: e.note, createdAt: e.createdAt })), canEdit: sh.sellerOrgId === c.organizationId } });
});

// PUT /api/v1/market/orders/:id/shipment -> penjual mengisi data pengiriman. Pesanan DITERIMA otomatis menjadi DIKIRIM.
export const PUT = tenantRoute<{ id: string }>({ permission: "market.manage" }, async (c) => {
  const orderId = uuid.parse(c.params.id);
  const input = shipmentUpsert.parse(await c.req.json());
  const o = await c.tx.marketOrder.findUnique({ where: { id: orderId } });
  if (!o) throw new ApiError(404, "NOT_FOUND", "Pesanan tidak ditemukan");
  if (o.sellerOrgId !== c.organizationId) throw new ApiError(403, "FORBIDDEN", "Hanya penjual yang mengisi pengiriman");
  if (o.status !== "ACCEPTED" && o.status !== "SHIPPED") throw new ApiError(409, "INVALID_TRANSITION", "Pengiriman hanya untuk pesanan yang sudah diterima");
  const data = { method: input.method, courier: input.courier ?? null, trackingNumber: input.trackingNumber ?? null, fee: input.fee, etaOn: input.etaOn ?? null, note: input.note ?? null };
  const sh = await c.tx.marketShipment.upsert({ where: { orderId }, update: data, create: { ...data, orderId, sellerOrgId: o.sellerOrgId, buyerOrgId: o.buyerOrgId } });
  if (o.status === "ACCEPTED") {
    const upd = await c.tx.marketOrder.updateMany({ where: { id: orderId, status: "ACCEPTED" }, data: { status: "SHIPPED" } });
    if (upd.count === 0) throw new ApiError(409, "CONFLICT", "Status pesanan baru saja berubah, muat ulang");
    await c.tx.marketShipmentEvent.create({ data: { shipmentId: sh.id, sellerOrgId: o.sellerOrgId, buyerOrgId: o.buyerOrgId, status: input.method === "AMBIL_SENDIRI" ? "DIKEMAS" : "DISERAHKAN_KURIR", note: "Pesanan dikirim", createdBy: c.userId } });
  }
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "market_shipment.upsert", entityType: "market_shipment", entityId: sh.id, after: { method: sh.method, courier: sh.courier } });
  if (o.status === "ACCEPTED") await notifyOrg(c.tx, o.buyerOrgId, { kind: "market.shipment", title: `Pesananmu dikirim: ${o.listingTitle}`, body: input.trackingNumber ? `Resi ${input.trackingNumber}` : undefined, href: "/app/pasar" });
  return Response.json({ data: { id: sh.id } });
});
