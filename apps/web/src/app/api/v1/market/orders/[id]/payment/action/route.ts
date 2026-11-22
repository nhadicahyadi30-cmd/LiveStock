import { paymentAction, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { notifyOrg } from "@/server/notify";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/market/orders/:id/payment/action
//  Penjual: CONFIRM_RECEIVED (dana diterima → HELD), REFUND (setelah sengketa → REFUNDED, pesanan dibatalkan, stok kembali)
//  Pembeli: DISPUTE (selagi PROOF_SUBMITTED/HELD dan pesanan belum selesai)
// RELEASED terjadi otomatis saat pembeli menekan "Barang diterima" (lihat orders/[id]/action).
export const POST = tenantRoute<{ id: string }>({ permission: "market.manage" }, async (c) => {
  const orderId = uuid.parse(c.params.id);
  const { action, reason } = paymentAction.parse(await c.req.json());
  const p = await c.tx.marketPayment.findUnique({ where: { orderId } });
  if (!p) throw new ApiError(404, "NOT_FOUND", "Belum ada pembayaran untuk pesanan ini");
  const isSeller = p.sellerOrgId === c.organizationId;
  const isBuyer = p.buyerOrgId === c.organizationId;
  const bad = () => new ApiError(409, "INVALID_TRANSITION", `Pembayaran berstatus ${p.status} tidak bisa diproses dengan aksi ini`);
  const deny = () => new ApiError(403, "FORBIDDEN", "Aksi ini bukan untuk Anda");
  const now = new Date();
  let data: Record<string, unknown>;
  if (action === "CONFIRM_RECEIVED") {
    if (!isSeller) throw deny(); if (p.status !== "PROOF_SUBMITTED") throw bad();
    data = { status: "HELD", heldAt: now };
  } else if (action === "DISPUTE") {
    if (!isBuyer) throw deny(); if (p.status !== "PROOF_SUBMITTED" && p.status !== "HELD") throw bad();
    data = { status: "DISPUTED", disputeReason: reason };
  } else {
    if (!isSeller) throw deny(); if (p.status !== "DISPUTED") throw bad();
    data = { status: "REFUNDED", refundedAt: now };
  }
  const upd = await c.tx.marketPayment.updateMany({ where: { id: p.id, status: p.status }, data });
  if (upd.count === 0) throw new ApiError(409, "CONFLICT", "Status pembayaran baru saja berubah, muat ulang");
  if (action === "REFUND") {
    const o = await c.tx.marketOrder.findUnique({ where: { id: orderId } });
    if (o && (o.status === "ACCEPTED" || o.status === "SHIPPED")) {
      await c.tx.marketListing.updateMany({ where: { id: o.listingId, sellerOrgId: c.organizationId }, data: { stock: { increment: o.quantity } } });
      await c.tx.marketOrder.updateMany({ where: { id: orderId, status: o.status }, data: { status: "CANCELLED" } });
    }
  }
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: `market_payment.${action.toLowerCase()}`, entityType: "market_payment", entityId: p.id, before: { status: p.status }, after: { status: data.status as string } });
  await notifyOrg(c.tx, isSeller ? p.buyerOrgId : p.sellerOrgId, { kind: "market.payment", title: action === "CONFIRM_RECEIVED" ? "Penjual mengonfirmasi pembayaranmu" : action === "DISPUTE" ? "Pembeli mengajukan sengketa pembayaran" : "Dana dikembalikan, pesanan dibatalkan", href: "/app/pasar" });
  return Response.json({ data: { id: p.id, status: data.status } });
});
