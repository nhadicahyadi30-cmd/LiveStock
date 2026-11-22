import { uuid } from "@sl/validation";
import { apiRoute } from "@/server/errors";
import { withApiKey } from "@/server/api-keys";

export const dynamic = "force-dynamic";

// GET /api/open/v1/production-records?batchId=&since=YYYY-MM-DD&limit= -> catatan produksi (tidak termasuk yang dibatalkan)
export function GET(req: Request): Promise<Response> {
  return apiRoute(req, () => withApiKey(req, async (tx) => {
    const q = new URL(req.url).searchParams;
    const batchId = q.get("batchId");
    const since = q.get("since");
    const limit = Math.min(500, Math.max(1, Number(q.get("limit")) || 100));
    const rows = await tx.productionRecord.findMany({ where: { voidedAt: null, ...(batchId ? { batchId: uuid.parse(batchId) } : {}), ...(since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? { producedOn: { gte: new Date(since) } } : {}) }, orderBy: [{ producedOn: "desc" }, { id: "desc" }], take: limit });
    return Response.json({ data: rows.map((r) => ({ id: r.id, batchId: r.batchId, kind: r.kind, quantity: Number(r.quantity), unit: r.unit, producedOn: r.producedOn.toISOString().slice(0, 10) })) });
  }));
}
