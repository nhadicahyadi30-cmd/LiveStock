import { budgetUpsert } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { requireFullAccess } from "@/server/finance";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// PUT /api/v1/finance/budgets { month, items: [{category, amount}] } -> mengatur anggaran bulanan per kategori
export const PUT = tenantRoute({ permission: "finance.manage" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const { month, items } = budgetUpsert.parse(await c.req.json());
  for (const it of items) {
    await c.tx.budget.upsert({ where: { organizationId_month_category: { organizationId: c.organizationId, month, category: it.category } }, update: { amount: it.amount }, create: { organizationId: c.organizationId, month, category: it.category, amount: it.amount } });
  }
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "budget.upsert", entityType: "budget", after: { month, count: items.length } });
  return Response.json({ data: { month, updated: items.length } });
});
