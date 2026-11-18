import { financeMonthQuery } from "@sl/validation";
import { addMonths, autoCosts, monthRange, requireFullAccess, ym } from "@/server/finance";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/finance/summary?month=YYYY-MM
//  Ringkasan bulan itu, arus kas 6 bulan, anggaran vs realisasi, dan piutang.
export const GET = tenantRoute({ permission: "finance.read" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const month = financeMonthQuery.parse(new URL(c.req.url).searchParams.get("month") ?? ym(new Date()));
  const { from, to } = monthRange(month);
  const seriesFrom = addMonths(from, -5);

  const [entries, costs, budgets, open] = await Promise.all([
    c.tx.financeEntry.findMany({ where: { voidedAt: null, occurredOn: { gte: seriesFrom, lt: to } }, select: { kind: true, category: true, amount: true, occurredOn: true } }),
    autoCosts(c.tx, seriesFrom, to),
    c.tx.budget.findMany({ where: { month } }),
    c.tx.invoice.findMany({ where: { status: "OPEN" }, select: { amount: true, dueOn: true } }),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => ym(addMonths(seriesFrom, i)));
  const series = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0 }]));
  const incomeBy: Record<string, number> = {};
  const expenseBy: Record<string, number> = {};
  for (const e of entries) {
    const m = ym(e.occurredOn); const row = series.get(m); const a = Number(e.amount);
    if (row) { if (e.kind === "INCOME") row.income += a; else row.expense += a; }
    if (m === month) { const bag = e.kind === "INCOME" ? incomeBy : expenseBy; bag[e.category] = (bag[e.category] ?? 0) + a; }
  }
  for (const k of costs) {
    const m = ym(k.date); const row = series.get(m);
    if (row) row.expense += k.amount;
    if (m === month) expenseBy[k.category] = (expenseBy[k.category] ?? 0) + k.amount;
  }
  const sum = (o: Record<string, number>) => Object.values(o).reduce((n, v) => n + v, 0);
  const income = sum(incomeBy); const expense = sum(expenseBy);
  const today = new Date(new Date().toISOString().slice(0, 10));

  return Response.json({
    data: {
      month, income, expense, profit: income - expense, incomeBy, expenseBy,
      cashflow: months.map((m) => series.get(m)!),
      budget: budgets.map((b) => ({ category: b.category, budget: Number(b.amount), actual: expenseBy[b.category] ?? 0 })),
      receivables: { total: open.reduce((n, i) => n + Number(i.amount), 0), count: open.length, overdue: open.filter((i) => i.dueOn < today).reduce((n, i) => n + Number(i.amount), 0), overdueCount: open.filter((i) => i.dueOn < today).length },
    },
  });
});
