import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/species -> referensi global (hanya baca) untuk formulir.
export const GET = tenantRoute({ permission: "livestock.read" }, async (c) => {
  const rows = await c.tx.species.findMany({ orderBy: { name: "asc" } });
  return Response.json({ data: rows });
});
