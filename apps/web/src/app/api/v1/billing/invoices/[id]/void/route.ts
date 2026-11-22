import { uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/billing/invoices/:id/void -> membatalkan tagihan yang belum dibayar
export const POST = tenantRoute<{ id: string }>({ permission: "members.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const upd = await c.tx.subscriptionInvoice.updateMany({ where: { id, status: "PENDING" }, data: { status: "VOID" } });
  if (upd.count === 0) throw new ApiError(409, "INVALID_TRANSITION", "Hanya tagihan yang belum dibayar yang bisa dibatalkan");
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "subscription_invoice.void", entityType: "subscription_invoice", entityId: id });
  return Response.json({ data: { id } });
});
