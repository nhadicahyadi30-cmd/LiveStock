import { uuid, voidRecord } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { requireFullAccess } from "@/server/finance";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/finance/entries/:id/void -> transaksi tidak dihapus, hanya dibatalkan. Transaksi hasil pelunasan invoice dibatalkan lewat invoice.
export const POST = tenantRoute<{ id: string }>({ permission: "finance.manage" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const id = uuid.parse(c.params.id);
  const { reason } = voidRecord.parse(await c.req.json());
  const e = await c.tx.financeEntry.findUnique({ where: { id } });
  if (!e) throw new ApiError(404, "NOT_FOUND", "Transaksi tidak ditemukan");
  if (e.voidedAt) throw new ApiError(409, "ALREADY_VOIDED", "Transaksi sudah dibatalkan");
  if (e.invoiceId) throw new ApiError(409, "LINKED_TO_INVOICE", "Transaksi ini berasal dari pelunasan invoice");
  const upd = await c.tx.financeEntry.update({ where: { id }, data: { voidedAt: new Date(), voidedBy: c.userId, voidReason: reason } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "finance_entry.void", entityType: "finance_entry", entityId: id, after: { reason } });
  return Response.json({ data: { id: upd.id } });
});
