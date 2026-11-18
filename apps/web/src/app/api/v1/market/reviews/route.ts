import { marketReviewCreate } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/market/reviews -> pembeli menilai penjual setelah pesanan selesai (satu ulasan per pesanan)
export const POST = tenantRoute({ permission: "market.manage" }, async (c) => {
  const input = marketReviewCreate.parse(await c.req.json());
  const o = await c.tx.marketOrder.findFirst({ where: { id: input.orderId, buyerOrgId: c.organizationId } });
  if (!o) throw new ApiError(404, "NOT_FOUND", "Pesanan tidak ditemukan");
  if (o.status !== "COMPLETED") throw new ApiError(409, "NOT_COMPLETED", "Ulasan hanya bisa diberikan setelah pesanan selesai");
  if (await c.tx.marketReview.findUnique({ where: { orderId: o.id } })) throw new ApiError(409, "ALREADY_REVIEWED", "Pesanan ini sudah diulas");
  const r = await c.tx.marketReview.create({ data: { orderId: o.id, sellerOrgId: o.sellerOrgId, buyerOrgId: c.organizationId, rating: input.rating, comment: input.comment } });
  return Response.json({ data: { id: r.id } }, { status: 201 });
});
