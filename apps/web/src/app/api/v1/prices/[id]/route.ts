import { uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// DELETE /api/v1/prices/:id -> membatalkan catatan harga (soft: voidedAt)
export const DELETE = tenantRoute<{ id: string }>({ permission: "market.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const row = await c.tx.marketPrice.findUnique({ where: { id } });
  if (!row || row.voidedAt) throw new ApiError(404, "NOT_FOUND", "Catatan harga tidak ditemukan");
  await c.tx.marketPrice.update({ where: { id }, data: { voidedAt: new Date() } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "market_price.void", entityType: "market_price", entityId: id });
  return Response.json({ data: { id } });
});
