import { paymentUpsert, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

const view = (p: { amount: unknown } & Record<string, unknown>) => ({ ...p, amount: Number(p.amount) });

// GET /api/v1/market/orders/:id/payment
export const GET = tenantRoute<{ id: string }>({ permission: "market.read" }, async (c) => {
  const orderId = uuid.parse(c.params.id);
  const p = await c.tx.marketPayment.findUnique({ where: { orderId } });
  const o = await c.tx.marketOrder.findUnique({ where: { id: orderId } });
  if (!o) throw new ApiError(404, "NOT_FOUND", "Pesanan tidak ditemukan");
  const sh = await c.tx.marketShipment.findUnique({ where: { orderId } });
  return Response.json({ data: { payment: p ? view(p) : null, orderTotal: Number(o.total), shippingFee: sh ? Number(sh.fee) : 0, role: o.buyerOrgId === c.organizationId ? "buyer" : "seller" } });
});

// PUT /api/v1/market/orders/:id/payment -> pembeli mencatat pembayaran (transfer/QRIS) atau memilih COD
export const PUT = tenantRoute<{ id: string }>({ permission: "market.manage" }, async (c) => {
  const orderId = uuid.parse(c.params.id);
  const input = paymentUpsert.parse(await c.req.json());
  const o = await c.tx.marketOrder.findUnique({ where: { id: orderId } });
  if (!o) throw new ApiError(404, "NOT_FOUND", "Pesanan tidak ditemukan");
  if (o.buyerOrgId !== c.organizationId) throw new ApiError(403, "FORBIDDEN", "Hanya pembeli yang mencatat pembayaran");
  if (o.status !== "ACCEPTED" && o.status !== "SHIPPED") throw new ApiError(409, "INVALID_TRANSITION", "Pembayaran dicatat setelah pesanan diterima penjual");
  const ex = await c.tx.marketPayment.findUnique({ where: { orderId } });
  if (ex && ex.status !== "AWAITING" && ex.status !== "PROOF_SUBMITTED") throw new ApiError(409, "INVALID_TRANSITION", "Pembayaran sudah diproses dan tidak bisa diubah");
  const sh = await c.tx.marketShipment.findUnique({ where: { orderId } });
  const amount = Number(o.total) + (sh ? Number(sh.fee) : 0);
  const submitted = input.method !== "COD";
  const data = { method: input.method, reference: input.reference ?? null, amount, status: submitted ? "PROOF_SUBMITTED" : "AWAITING", submittedAt: submitted ? new Date() : null };
  const p = await c.tx.marketPayment.upsert({ where: { orderId }, update: data, create: { ...data, orderId, buyerOrgId: o.buyerOrgId, sellerOrgId: o.sellerOrgId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "market_payment.submit", entityType: "market_payment", entityId: p.id, after: { method: p.method, amount } });
  return Response.json({ data: view(p) });
});
