import { apiRoute } from "@/server/errors";
import { withApiKey } from "@/server/api-keys";

export const dynamic = "force-dynamic";

// GET /api/open/v1/farms -> daftar farm (baca saja)
export function GET(req: Request): Promise<Response> {
  return apiRoute(req, () => withApiKey(req, async (tx) => {
    const rows = await tx.farm.findMany({ orderBy: { id: "asc" }, take: 200 });
    return Response.json({ data: rows.map((f) => ({ id: f.id, name: f.name })) });
  }));
}
