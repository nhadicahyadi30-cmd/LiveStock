import { apiRoute } from "@/server/errors";
import { authenticateDevice } from "@/server/iot";

export const dynamic = "force-dynamic";

// GET /api/iot/v1/ping -> uji token dan koneksi; mengembalikan nama perangkat dan waktu server
export function GET(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const d = await authenticateDevice(req);
    return Response.json({ data: { ok: true, device: d.name, serverTime: new Date().toISOString(), serverEpoch: Math.floor(Date.now() / 1000) } });
  });
}
