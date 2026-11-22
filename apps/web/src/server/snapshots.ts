import type { Tx } from "@sl/database";

export const MAX_SNAPSHOT_BYTES = 1_572_864; // 1,5 MB
export const MIN_SNAPSHOT_INTERVAL_MS = 5_000;
export const KEEP_PER_DEVICE = 100;
export const KEEP_DAYS = 14;

/** Jenis gambar ditentukan dari isi file (magic bytes), bukan dari header yang dikirim perangkat. */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Menghapus foto lama: lebih tua dari KEEP_DAYS, atau di luar KEEP_PER_DEVICE terbaru. */
export async function pruneSnapshots(tx: Tx, deviceId: string): Promise<void> {
  await tx.cameraSnapshot.deleteMany({ where: { deviceId, capturedAt: { lt: new Date(Date.now() - KEEP_DAYS * 864e5) } } });
  const keep = await tx.cameraSnapshot.findMany({ where: { deviceId }, orderBy: { capturedAt: "desc" }, take: KEEP_PER_DEVICE, select: { id: true } });
  if (keep.length === KEEP_PER_DEVICE) await tx.cameraSnapshot.deleteMany({ where: { deviceId, id: { notIn: keep.map((k) => k.id) } } });
}
