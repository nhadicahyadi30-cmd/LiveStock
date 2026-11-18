import { uuid, voidRecord } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { requireFullAccess } from "@/server/finance";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/finance/invoices/:id/void -> membatalkan invoice. Invoice lunas ikut membatalkan pemasukannya.
export const POST = tenantRoute<{ id: string }>({ permission: "finance.manage" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const id = uuid.parse(c.params.id);
  const { reason } = voidRecord.parse(await c.req.json());
  const inv = await c.tx.invoice.findUnique({ where: { id } });
  if (!inv) throw new ApiError(404, "NOT_FOUND", "Invoice tidak ditemukan");
  if (inv.status === "VOID") throw new ApiError(409, "ALREADY_VOIDED", "Invoice sudah dibatalkan");
  await c.tx.invoice.update({ where: { id }, data: { status: "VOID", paidOn: null } });
  await c.tx.financeEntry.updateMany({ where: { invoiceId: id, voidedAt: null }, data: { voidedAt: new Date(), voidedBy: c.userId, voidReason: `Invoice dibatalkan: ${reason}` } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "invoice.void", entityType: "invoice", entityId: id, before: { status: inv.status }, after: { reason } });
  return Response.json({ data: { id, status: "VOID" } });
});
