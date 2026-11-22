import type { Tx } from "@sl/database";
import { addMonths, autoCosts, ym } from "./finance";
import { summarizeEligibility, type Eligibility } from "./eligibility";

/** Membaca catatan keuangan 6 bulan terakhir organisasi aktif dan meringkasnya. */
export async function loadEligibility(tx: Tx): Promise<Eligibility> {
  const now = new Date();
  const to = addMonths(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), 1);
  const from = addMonths(to, -6);
  const [entries, costs, batches, open] = await Promise.all([
    tx.financeEntry.findMany({ where: { voidedAt: null, occurredOn: { gte: from, lt: to } }, select: { kind: true, amount: true, occurredOn: true } }),
    autoCosts(tx, from, to),
    tx.livestockBatch.count({ where: { status: "ACTIVE" } }),
    tx.invoice.findMany({ where: { status: "OPEN" }, select: { amount: true } }),
  ]);
  const months = Array.from({ length: 6 }, (_, i) => ym(addMonths(from, i)));
  const map = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0 }]));
  for (const e of entries) { const r = map.get(ym(e.occurredOn)); if (r) { if (e.kind === "INCOME") r.income += Number(e.amount); else r.expense += Number(e.amount); } }
  for (const k of costs) { const r = map.get(ym(k.date)); if (r) r.expense += k.amount; }
  return summarizeEligibility([...map.values()], batches, open.reduce((s, i) => s + Number(i.amount), 0));
}
