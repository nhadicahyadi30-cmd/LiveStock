import { apiRoute } from "@/server/errors";
import { withApiKey } from "@/server/api-keys";

export const dynamic = "force-dynamic";

// GET /api/open/v1/alerts?open=true -> alarm sensor IoT
export function GET(req: Request): Promise<Response> {
  return apiRoute(req, () => withApiKey(req, async (tx) => {
    const onlyOpen = new URL(req.url).searchParams.get("open") === "true";
    const rows = await tx.alertEvent.findMany({ where: onlyOpen ? { resolvedAt: null } : {}, orderBy: { id: "desc" }, take: 200 });
    return Response.json({ data: rows.map((a) => ({ id: a.id, deviceId: a.deviceId, rule: a.ruleName, metric: a.metric, op: a.op, threshold: a.threshold, value: a.value, resolvedAt: a.resolvedAt })) });
  }));
}
