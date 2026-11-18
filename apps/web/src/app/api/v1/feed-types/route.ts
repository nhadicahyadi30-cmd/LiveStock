import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/feed-types -> daftar nama pakan yang pernah dipakai (untuk saran isian).
export const GET = tenantRoute({ permission: "livestock.read" }, async (c) => {
  const rows = await c.tx.feedType.findMany({ orderBy: { name: "asc" }, take: 200 });
  return Response.json({ data: rows });
});
