import { uuid } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { imageIdsFor } from "@/server/listing-images";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/market/vendors/:orgId -> profil publik penjual: toko, rating, ulasan terbaru, dan produk yang tayang.
export const GET = tenantRoute<{ orgId: string }>({ permission: "market.read" }, async (c) => {
  const orgId = uuid.parse(c.params.orgId);
  const profile = await c.tx.vendorProfile.findUnique({ where: { orgId } });
  if (!profile) throw new ApiError(404, "NOT_FOUND", "Toko tidak ditemukan");
  const [agg, reviews, listings] = await Promise.all([
    c.tx.marketReview.aggregate({ where: { sellerOrgId: orgId }, _avg: { rating: true }, _count: { rating: true } }),
    c.tx.marketReview.findMany({ where: { sellerOrgId: orgId }, orderBy: { id: "desc" }, take: 10, select: { id: true, rating: true, comment: true, createdAt: true } }),
    c.tx.marketListing.findMany({ where: { sellerOrgId: orgId, status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const imgs = await imageIdsFor(c.tx, listings.map((l) => l.id));
  return Response.json({
    data: {
      orgId, name: profile.displayName, city: profile.city, phone: profile.phone, about: profile.about,
      isMe: orgId === c.organizationId,
      rating: { avg: agg._avg.rating ?? 0, count: agg._count.rating },
      reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt })),
      listings: listings.map((l) => ({ id: l.id, title: l.title, category: l.category, unit: l.unit, priceIdr: Number(l.priceIdr), stock: Number(l.stock), images: imgs.get(l.id) ?? [] })),
    },
  });
});
