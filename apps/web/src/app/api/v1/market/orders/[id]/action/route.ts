import { marketOrderAction, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { notifyOrg } from "@/server/notify";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/market/orders/:id/action  { action }
//  Penjual: ACCEPT (stok berkurang), REJECT, SHIP, CANCEL (setelah diterima; stok kembali)
//  Pembeli: CANCEL (selagi PENDING), COMPLETE (setelah dikirim)
export const POST = tenantRoute<{ id: string }>({ permission: "market.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const { action } = marketOrderAction.parse(await c.req.json());
  const o = await c.tx.marketOrder.findUnique({ where: { id } });
  if (!o) throw new ApiError(404, "NOT_FOUND", "Pesanan tidak ditemukan");
  const isSeller = o.sellerOrgId === c.organizationId;
  const isBuyer = o.buyerOrgId === c.organizationId;
  const bad = () => new ApiError(409, "INVALID_TRANSITION", `Pesanan berstatus ${o.status} tidak bisa diproses dengan aksi ini`);
  const deny = () => new ApiError(403, "FORBIDDEN", "Aksi ini bukan untuk Anda");

  let next: "ACCEPTED" | "REJECTED" | "SHIPPED" | "COMPLETED" | "CANCELLED";
  if (action === "ACCEPT") {
    if (!isSeller) throw deny(); if (o.status !== "PENDING") throw bad();
    const dec = await c.tx.marketListing.updateMany({ where: { id: o.listingId, sellerOrgId: c.organizationId, status: "PUBLISHED", stock: { gte: o.quantity } }, data: { stock: { decrement: o.quantity } } });
    if (dec.count === 0) throw new ApiError(409, "INSUFFICIENT_STOCK", "Stok tidak cukup atau produk tidak lagi dijual");
    next = "ACCEPTED";
  } else if (action === "REJECT") {
    if (!isSeller) throw deny(); if (o.status !== "PENDING") throw bad();
    next = "REJECTED";
  } else if (action === "SHIP") {
    if (!isSeller) throw deny(); if (o.status !== "ACCEPTED") throw bad();
    next = "SHIPPED";
  } else if (action === "COMPLETE") {
    if (!isBuyer) throw deny(); if (o.status !== "SHIPPED") throw bad();
    const pay = await c.tx.marketPayment.findUnique({ where: { orderId: id } });
    if (pay?.status === "DISPUTED") throw new ApiError(409, "PAYMENT_DISPUTED", "Pembayaran sedang disengketakan; selesaikan dulu dengan penjual");
    if (pay && (pay.status === "HELD" || (pay.method === "COD" && pay.status === "AWAITING"))) await c.tx.marketPayment.update({ where: { id: pay.id }, data: { status: "RELEASED", releasedAt: new Date() } });
    next = "COMPLETED";
  } else {
    if (isBuyer && o.status === "PENDING") next = "CANCELLED";
    else if (isSeller && o.status === "ACCEPTED") {
      await c.tx.marketListing.updateMany({ where: { id: o.listingId, sellerOrgId: c.organizationId }, data: { stock: { increment: o.quantity } } });
      next = "CANCELLED";
    } else if (isBuyer || isSeller) throw bad();
    else throw deny();
  }
  const upd = await c.tx.marketOrder.updateMany({ where: { id, status: o.status }, data: { status: next } });
  if (upd.count === 0) throw new ApiError(409, "CONFLICT", "Status pesanan baru saja berubah, muat ulang");
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: `market_order.${action.toLowerCase()}`, entityType: "market_order", entityId: id, before: { status: o.status }, after: { status: next } });
  const LABEL = { ACCEPTED: "diterima penjual", REJECTED: "ditolak penjual", SHIPPED: "dikirim", COMPLETED: "diterima pembeli (selesai)", CANCELLED: "dibatalkan" } as const;
  await notifyOrg(c.tx, isSeller ? o.buyerOrgId : o.sellerOrgId, { kind: "market.order_status", title: `Pesanan ${LABEL[next]}: ${o.listingTitle}`, href: "/app/pasar" });
  return Response.json({ data: { id, status: next } });
});
