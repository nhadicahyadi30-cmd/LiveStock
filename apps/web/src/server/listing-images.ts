import type { Tx } from "@sl/database";

export const MAX_LISTING_IMAGES = 4;
export const MAX_LISTING_IMAGE_BYTES = 716_800; // 700 KB

/** Peta listingId -> daftar id foto (urut), tanpa memuat isi gambar. */
export async function imageIdsFor(tx: Tx, listingIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (listingIds.length === 0) return map;
  const rows = await tx.marketListingImage.findMany({ where: { listingId: { in: listingIds } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, listingId: true } });
  for (const r of rows) map.set(r.listingId, [...(map.get(r.listingId) ?? []), r.id]);
  return map;
}
