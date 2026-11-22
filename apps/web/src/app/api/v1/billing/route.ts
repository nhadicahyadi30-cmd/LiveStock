import { currentPlan, usage } from "@/server/plan-guard";
import { PAID_PLANS, PLANS } from "@/server/plans";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/billing -> paket aktif, pemakaian vs batas, daftar paket, riwayat tagihan
export const GET = tenantRoute({ permission: "dashboard.read" }, async (c) => {
  const p = await currentPlan(c.tx, c.organizationId);
  const u = await usage(c.tx, c.organizationId);
  const invoices = await c.tx.subscriptionInvoice.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return Response.json({
    data: {
      plan: p.plan, storedPlan: p.stored, expiresAt: p.expiresAt, usage: u, limits: PLANS[p.plan].limits,
      plans: [...(["FREE"] as const), ...PAID_PLANS, "ENTERPRISE" as const].map((id) => PLANS[id]),
      invoices: invoices.map((i) => ({ id: i.id, number: i.number, plan: i.plan, months: i.months, amount: Number(i.amount), status: i.status, dueOn: i.dueOn.toISOString().slice(0, 10), paidAt: i.paidAt })),
      paymentInfo: process.env.BILLING_PAYMENT_INFO ?? null,
      canManage: c.role === "OWNER",
    },
  });
});
