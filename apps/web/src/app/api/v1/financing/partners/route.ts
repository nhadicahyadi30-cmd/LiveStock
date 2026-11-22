import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/financing/partners -> mitra pembiayaan aktif
export const GET = tenantRoute({ permission: "finance.read" }, async (c) => {
  const rows = await c.tx.financingPartner.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: 100 });
  return Response.json({ data: rows.map((p) => ({ id: p.id, name: p.name, kind: p.kind, description: p.description, minAmount: p.minAmount ? Number(p.minAmount) : null, maxAmount: p.maxAmount ? Number(p.maxAmount) : null, rateInfo: p.rateInfo, contactUrl: p.contactUrl, contactPhone: p.contactPhone })) });
});
