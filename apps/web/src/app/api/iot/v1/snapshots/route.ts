import { withTenant } from "@sl/database";
import { ApiError, apiRoute } from "@/server/errors";
import { authenticateDevice } from "@/server/iot";
import { MAX_SNAPSHOT_BYTES, MIN_SNAPSHOT_INTERVAL_MS, pruneSnapshots, sniffImage } from "@/server/snapshots";

export const dynamic = "force-dynamic";

// POST /api/iot/v1/snapshots  (Authorization: Bearer <token perangkat>)
// Isi: berkas gambar mentah (JPEG/PNG/WEBP, maks. 1,5 MB) sebagai body. Contoh: curl --data-binary @foto.jpg -H "Authorization: Bearer nt_dev_..." URL
export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const d = await authenticateDevice(req);
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_SNAPSHOT_BYTES) throw new ApiError(413, "TOO_LARGE", "Gambar terlalu besar (maks. 1,5 MB)");
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length > MAX_SNAPSHOT_BYTES) throw new ApiError(413, "TOO_LARGE", "Gambar terlalu besar (maks. 1,5 MB)");
    const type = sniffImage(buf);
    if (!type || buf.length < 100) throw new ApiError(415, "UNSUPPORTED_MEDIA", "Isi harus gambar JPEG, PNG, atau WEBP");
    const id = await withTenant({ organizationId: d.organizationId, userId: d.createdBy }, async (tx) => {
      const last = await tx.cameraSnapshot.findFirst({ where: { deviceId: d.id }, orderBy: { capturedAt: "desc" }, select: { capturedAt: true } });
      if (last && Date.now() - last.capturedAt.getTime() < MIN_SNAPSHOT_INTERVAL_MS) throw new ApiError(429, "RATE_LIMITED", "Terlalu sering: minimal 5 detik antar foto");
      const row = await tx.cameraSnapshot.create({ data: { organizationId: d.organizationId, deviceId: d.id, contentType: type, sizeBytes: buf.length, data: buf } });
      await tx.device.update({ where: { id: d.id }, data: { lastSeenAt: new Date() } });
      await pruneSnapshots(tx, d.id);
      return row.id;
    });
    return Response.json({ data: { id } }, { status: 201 });
  });
}
