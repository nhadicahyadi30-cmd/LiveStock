import { marketOrderCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { notifyOrg } from "@/server/notify";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/market/orders?role=buy|sell  -> pesanan sebagai pembeli atau penjual
export const GET = tenantRoute({ permission: "market.read" }, async (c) => {
  const sell = new URL(c.req.url).searchParams.get("role") === "sell";
  const rows = await c.tx.marketOrder.findMany({ where: sell ? { sellerOrgId: c.organizationId } : { buyerOrgId: c.organizationId }, orderBy: { createdAt: "desc" }, take: 100 });
  const otherIds = [...new Set(rows.map((r) => (sell ? r.buyerOrgId : r.sellerOrgId)))];
  const profiles = await c.tx.vendorProfile.findMany({ where: { orgId: { in: otherIds } } });
  const prof = new Map(profiles.map((p) => [p.orgId, p]));
  const reviews = !sell && rows.length ? await c.tx.marketReview.findMany({ where: { orderId: { in: rows.map((r) => r.id) } }, select: { orderId: true } }) : [];
  const reviewed = new Set(reviews.map((r) => r.orderId));
  return Response.json({
    data: rows.map((r) => {
      const p = prof.get(sell ? r.buyerOrgId : r.sellerOrgId);
      return {
        id: r.id, listingTitle: r.listingTitle, unit: r.unit, status: r.status, buyerNote: r.buyerNote, createdAt: r.createdAt,
        quantity: Number(r.quantity), unitPrice: Number(r.unitPrice), total: Number(r.total), reviewed: reviewed.has(r.id),
        // Kontak pihak lain hanya dibuka setelah pesanan diterima.
        counterparty: { name: p?.displayName ?? (sell ? "Pembeli" : "Penjual"), phone: r.status === "PENDING" || r.status === "REJECTED" ? null : (p?.phone ?? null) },
      };
    }),
  });
});

// POST /api/v1/market/orders -> pembeli membuat pesanan; harga diambil dari listing, bukan dari klien
export const POST = tenantRoute({ permission: "market.manage" }, async (c) => {
  const input = marketOrderCreate.parse(await c.req.json());
  if (input.clientId) {
    const ex = await c.tx.marketOrder.findUnique({ where: { buyerOrgId_clientId: { buyerOrgId: c.organizationId, clientId: input.clientId } } });
    if (ex) return Response.json({ data: { id: ex.id } }, { status: 200 });
  }
  const listing = await c.tx.marketListing.findFirst({ where: { id: input.listingId, status: "PUBLISHED" } });
  if (!listing) throw new ApiError(404, "NOT_FOUND", "Produk tidak ditemukan atau sudah tidak dijual");
  if (listing.sellerOrgId === c.organizationId) throw new ApiError(422, "OWN_LISTING", "Tidak bisa membeli produk sendiri");
  if (Number(listing.stock) < input.quantity) throw new ApiError(409, "INSUFFICIENT_STOCK", "Stok tidak cukup");

  const total = Math.round(Number(listing.priceIdr) * input.quantity * 100) / 100;
  const order = await c.tx.marketOrder.create({
    data: { listingId: listing.id, buyerOrgId: c.organizationId, sellerOrgId: listing.sellerOrgId, listingTitle: listing.title, unit: listing.unit, quantity: input.quantity, unitPrice: listing.priceIdr, total, buyerNote: input.note, createdBy: c.userId, clientId: input.clientId },
  });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "market_order.create", entityType: "market_order", entityId: order.id, after: { total, listing: listing.title } });
  await notifyOrg(c.tx, listing.sellerOrgId, { kind: "market.order", title: `Pesanan baru: ${listing.title}`, body: `${input.quantity} ${listing.unit}, total Rp ${Math.round(total).toLocaleString("id-ID")}`, href: "/app/pasar" });
  return Response.json({ data: { id: order.id, total } }, { status: 201 });
});
