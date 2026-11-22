import { uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/market/images/:imageId -> gambar. Terlihat bila produknya tayang atau milik organisasi sendiri (RLS).
export const GET = tenantRoute<{ imageId: string }>({ permission: "market.read" }, async (c) => {
  const id = uuid.parse(c.params.imageId);
  const img = await c.tx.marketListingImage.findUnique({ where: { id } });
  if (!img) throw new ApiError(404, "NOT_FOUND", "Foto tidak ditemukan");
  return new Response(new Uint8Array(img.data), { headers: { "content-type": img.contentType, "content-length": String(img.sizeBytes), "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
});

// DELETE /api/v1/market/images/:imageId (penjual)
export const DELETE = tenantRoute<{ imageId: string }>({ permission: "market.manage" }, async (c) => {
  const id = uuid.parse(c.params.imageId);
  const res = await c.tx.marketListingImage.deleteMany({ where: { id, sellerOrgId: c.organizationId } });
  if (res.count === 0) throw new ApiError(404, "NOT_FOUND", "Foto tidak ditemukan");
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "listing_image.delete", entityType: "listing_image", entityId: id });
  return Response.json({ data: { id } });
});
