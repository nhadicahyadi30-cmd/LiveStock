import { listingCategories, listingCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { imageIdsFor } from "@/server/listing-images";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/market/listings?scope=all|browse|mine&category=&q=
//  all: semua produk yang tayang (termasuk milik sendiri, ditandai isMine); browse: tayang milik orang lain;
//  mine: semua listing organisasi sendiri (termasuk draf).
export const GET = tenantRoute({ permission: "market.read" }, async (c) => {
  const url = new URL(c.req.url);
  const scope = url.searchParams.get("scope");
  const mine = scope === "mine";
  const all = scope === "all";
  const category = listingCategories.find((k) => k === url.searchParams.get("category"));
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  const rows = await c.tx.marketListing.findMany({
    where: {
      ...(mine ? { sellerOrgId: c.organizationId } : all ? { status: "PUBLISHED" as const, stock: { gt: 0 } } : { status: "PUBLISHED" as const, sellerOrgId: { not: c.organizationId }, stock: { gt: 0 } }),
      ...(category ? { category } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const sellerIds = [...new Set(rows.map((r) => r.sellerOrgId))];
  const [images, profiles, ratings] = await Promise.all([
    imageIdsFor(c.tx, rows.map((r) => r.id)),
    c.tx.vendorProfile.findMany({ where: { orgId: { in: sellerIds } } }),
    c.tx.marketReview.groupBy({ by: ["sellerOrgId"], where: { sellerOrgId: { in: sellerIds } }, _avg: { rating: true }, _count: { rating: true } }),
  ]);
  const prof = new Map(profiles.map((p) => [p.orgId, p]));
  const rate = new Map(ratings.map((r) => [r.sellerOrgId, { avg: r._avg.rating ?? 0, count: r._count.rating }]));
  return Response.json({
    data: rows.map((r) => ({
      id: r.id, sellerOrgId: r.sellerOrgId, isMine: r.sellerOrgId === c.organizationId, images: images.get(r.id) ?? [], title: r.title, category: r.category, description: r.description, unit: r.unit, status: r.status,
      priceIdr: Number(r.priceIdr), stock: Number(r.stock), createdAt: r.createdAt,
      seller: { name: prof.get(r.sellerOrgId)?.displayName ?? "Penjual", city: prof.get(r.sellerOrgId)?.city ?? "", phone: prof.get(r.sellerOrgId)?.phone ?? "", rating: rate.get(r.sellerOrgId) ?? { avg: 0, count: 0 } },
    })),
  });
});

// POST /api/v1/market/listings  (izin market.manage; butuh profil toko)
export const POST = tenantRoute({ permission: "market.manage" }, async (c) => {
  const input = listingCreate.parse(await c.req.json());
  const profile = await c.tx.vendorProfile.findUnique({ where: { orgId: c.organizationId } });
  if (!profile) throw new ApiError(409, "PROFILE_REQUIRED", "Lengkapi profil toko dulu sebelum berjualan");
  const row = await c.tx.marketListing.create({ data: { ...input, sellerOrgId: c.organizationId, createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "listing.create", entityType: "listing", entityId: row.id, after: { title: row.title } });
  return Response.json({ data: { ...row, priceIdr: Number(row.priceIdr), stock: Number(row.stock) } }, { status: 201 });
});
