import { apiRoute } from "@/server/errors";
import { withApiKey } from "@/server/api-keys";

export const dynamic = "force-dynamic";

// GET /api/open/v1/batches?status=ACTIVE -> batch beserta populasi saat ini (baca saja)
export function GET(req: Request): Promise<Response> {
  return apiRoute(req, () => withApiKey(req, async (tx) => {
    const status = new URL(req.url).searchParams.get("status");
    const rows = await tx.livestockBatch.findMany({ where: status === "ACTIVE" || status === "CLOSED" ? { status } : {}, orderBy: { id: "desc" }, take: 200 });
    const pop = await tx.$queryRaw<{ batch_id: string; current_count: number }[]>`SELECT batch_id, current_count::int AS current_count FROM batch_population`;
    const byId = new Map(pop.map((p) => [p.batch_id, p.current_count]));
    return Response.json({ data: rows.map((b) => ({ id: b.id, code: b.code, farmId: b.farmId, status: b.status, startDate: b.startDate.toISOString().slice(0, 10), initialCount: b.initialCount, currentCount: byId.get(b.id) ?? null })) });
  }));
}
