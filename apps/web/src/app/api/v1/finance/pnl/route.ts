import { autoCosts, requireFullAccess } from "@/server/finance";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/finance/pnl -> laba-rugi dan HPP per batch (seluruh waktu)
//  HPP per ekor = total biaya / populasi awal. Biaya = pakan + kesehatan (otomatis) + pengeluaran manual yang ditandai batch.
export const GET = tenantRoute({ permission: "finance.read" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const far = new Date(Date.UTC(2000, 0, 1)); const future = new Date(Date.UTC(2100, 0, 1));
  const [batches, entries, costs] = await Promise.all([
    c.tx.livestockBatch.findMany({ select: { id: true, code: true, status: true, initialCount: true }, orderBy: { startDate: "desc" }, take: 200 }),
    c.tx.financeEntry.findMany({ where: { voidedAt: null, batchId: { not: null } }, select: { kind: true, amount: true, batchId: true } }),
    autoCosts(c.tx, far, future),
  ]);
  const rows = batches.map((b) => {
    let revenue = 0, feed = 0, health = 0, other = 0;
    for (const e of entries) if (e.batchId === b.id) { if (e.kind === "INCOME") revenue += Number(e.amount); else other += Number(e.amount); }
    for (const k of costs) if (k.batchId === b.id) { if (k.category === "PAKAN") feed += k.amount; else health += k.amount; }
    const cost = feed + health + other;
    return { id: b.id, code: b.code, status: b.status, initialCount: b.initialCount, revenue, feed, health, other, cost, profit: revenue - cost, hppPerHead: b.initialCount > 0 ? cost / b.initialCount : 0 };
  });
  return Response.json({ data: rows });
});
