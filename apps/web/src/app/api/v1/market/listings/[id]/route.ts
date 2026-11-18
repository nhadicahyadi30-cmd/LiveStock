import { listingUpdate, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// PATCH /api/v1/market/listings/:id -> ubah harga, stok, status (hanya penjual; RLS juga menjaga ini)
export const PATCH = tenantRoute<{ id: string }>({ permission: "market.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const input = listingUpdate.parse(await c.req.json());
  const res = await c.tx.marketListing.updateMany({ where: { id, sellerOrgId: c.organizationId }, data: input });
  if (res.count === 0) throw new ApiError(404, "NOT_FOUND", "Listing tidak ditemukan");
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "listing.update", entityType: "listing", entityId: id, after: input });
  return Response.json({ data: { id } });
});
