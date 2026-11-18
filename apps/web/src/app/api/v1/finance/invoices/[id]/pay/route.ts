import { invoicePay, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { requireFullAccess } from "@/server/finance";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/finance/invoices/:id/pay -> tandai lunas dan otomatis mencatat pemasukan (dalam satu transaksi)
export const POST = tenantRoute<{ id: string }>({ permission: "finance.manage" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const id = uuid.parse(c.params.id);
  const { paidOn, category } = invoicePay.parse(await c.req.json().catch(() => ({})));
  const inv = await c.tx.invoice.findUnique({ where: { id } });
  if (!inv) throw new ApiError(404, "NOT_FOUND", "Invoice tidak ditemukan");
  const when = paidOn ?? new Date();
  const claimed = await c.tx.invoice.updateMany({ where: { id, status: "OPEN" }, data: { status: "PAID", paidOn: when } });
  if (claimed.count === 0) throw new ApiError(409, "INVALID_STATE", "Invoice ini tidak berstatus terbuka");
  await c.tx.financeEntry.create({ data: { organizationId: c.organizationId, kind: "INCOME", category, amount: inv.amount, occurredOn: when, batchId: inv.batchId, invoiceId: inv.id, description: `Pelunasan ${inv.number} - ${inv.customerName}`, recordedBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "invoice.pay", entityType: "invoice", entityId: id, after: { amount: Number(inv.amount) } });
  return Response.json({ data: { id, status: "PAID" } });
});
