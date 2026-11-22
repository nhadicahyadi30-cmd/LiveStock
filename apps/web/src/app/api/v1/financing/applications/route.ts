import { financingApplicationCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { requireFullAccess } from "@/server/finance";
import { loadEligibility } from "@/server/finance-eligibility";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/financing/applications -> pengajuan organisasi ini
export const GET = tenantRoute({ permission: "finance.read" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const rows = await c.tx.financingApplication.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const partners = await c.tx.financingPartner.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.partnerId))] } } });
  const name = (id: string) => partners.find((p) => p.id === id)?.name ?? "-";
  return Response.json({ data: rows.map((r) => ({ id: r.id, partner: name(r.partnerId), amount: Number(r.amount), tenorMonths: r.tenorMonths, purpose: r.purpose, note: r.note, status: r.status, partnerNote: r.partnerNote, createdAt: r.createdAt })) });
});

// POST /api/v1/financing/applications -> mengajukan ke mitra. Ringkasan keuangan saat itu ikut disimpan.
export const POST = tenantRoute({ permission: "finance.manage" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const input = financingApplicationCreate.parse(await c.req.json());
  const partner = await c.tx.financingPartner.findFirst({ where: { id: input.partnerId, active: true } });
  if (!partner) throw new ApiError(404, "NOT_FOUND", "Mitra tidak ditemukan");
  if (partner.minAmount && input.amount < Number(partner.minAmount)) throw new ApiError(422, "AMOUNT_OUT_OF_RANGE", "Jumlah di bawah minimum mitra ini");
  if (partner.maxAmount && input.amount > Number(partner.maxAmount)) throw new ApiError(422, "AMOUNT_OUT_OF_RANGE", "Jumlah di atas maksimum mitra ini");
  const open = await c.tx.financingApplication.count({ where: { partnerId: partner.id, status: { in: ["SUBMITTED", "IN_REVIEW"] } } });
  if (open > 0) throw new ApiError(409, "DUPLICATE", "Masih ada pengajuan ke mitra ini yang sedang diproses");
  const snapshot = await loadEligibility(c.tx);
  const row = await c.tx.financingApplication.create({ data: { organizationId: c.organizationId, partnerId: partner.id, amount: input.amount, tenorMonths: input.tenorMonths, purpose: input.purpose, note: input.note ?? null, snapshot: JSON.parse(JSON.stringify(snapshot)), createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "financing_application.create", entityType: "financing_application", entityId: row.id, after: { partner: partner.name, amount: input.amount } });
  return Response.json({ data: { id: row.id } }, { status: 201 });
});
