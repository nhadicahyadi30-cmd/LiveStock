import { uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { MAX_LISTING_IMAGES, MAX_LISTING_IMAGE_BYTES } from "@/server/listing-images";
import { sniffImage } from "@/server/snapshots";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/market/listings/:id/images  -> body: berkas gambar mentah (JPEG/PNG/WEBP, maks. 700 KB), izin market.manage.
export const POST = tenantRoute<{ id: string }>({ permission: "market.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const declared = Number(c.req.headers.get("content-length") ?? 0);
  if (declared > MAX_LISTING_IMAGE_BYTES + 1024) throw new ApiError(413, "TOO_LARGE", "Foto terlalu besar (maks. 700 KB)");
  const buf = new Uint8Array(await c.req.arrayBuffer());
  if (buf.length > MAX_LISTING_IMAGE_BYTES) throw new ApiError(413, "TOO_LARGE", "Foto terlalu besar (maks. 700 KB)");
  const type = sniffImage(buf);
  if (!type || buf.length < 100) throw new ApiError(415, "UNSUPPORTED_MEDIA", "Isi harus gambar JPEG, PNG, atau WEBP");

  const listing = await c.tx.marketListing.findFirst({ where: { id, sellerOrgId: c.organizationId }, select: { id: true } });
  if (!listing) throw new ApiError(404, "NOT_FOUND", "Produk tidak ditemukan");
  const count = await c.tx.marketListingImage.count({ where: { listingId: id } });
  if (count >= MAX_LISTING_IMAGES) throw new ApiError(409, "TOO_MANY", `Maksimal ${MAX_LISTING_IMAGES} foto per produk`);
  const last = await c.tx.marketListingImage.findFirst({ where: { listingId: id }, orderBy: { position: "desc" }, select: { position: true } });
  const row = await c.tx.marketListingImage.create({ data: { listingId: id, sellerOrgId: c.organizationId, contentType: type, sizeBytes: buf.length, position: (last?.position ?? -1) + 1, data: buf } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "listing_image.create", entityType: "listing", entityId: id, after: { imageId: row.id } });
  return Response.json({ data: { id: row.id } }, { status: 201 });
});
