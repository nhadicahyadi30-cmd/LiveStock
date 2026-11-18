import { apiRoute } from "@/server/errors";
import { authenticateDevice, ingest, normalizePayload } from "@/server/iot";

export const dynamic = "force-dynamic";

// POST /api/iot/v1/readings  (Authorization: Bearer <token perangkat>)
// Isi: {"temperature":28.4,"humidity":70} | {"metric":"temperature","value":28.4} | {"readings":[{...}]}
export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const d = await authenticateDevice(req);
    const body: unknown = await req.json().catch(() => null);
    const result = await ingest(d, normalizePayload(body));
    return Response.json({ data: result }, { status: 201 });
  });
}
