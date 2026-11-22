import { uuid } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { flushOrg } from "@/server/webhooks";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/integrations/deliveries/:id/retry -> kirim ulang pengiriman yang gagal
export const POST = tenantRoute<{ id: string }>({ permission: "members.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const upd = await c.tx.webhookDelivery.updateMany({ where: { id, status: { in: ["FAILED", "PENDING"] } }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null } });
  if (upd.count === 0) throw new ApiError(409, "INVALID_TRANSITION", "Hanya pengiriman yang gagal atau menunggu yang bisa dikirim ulang");
  const t = setTimeout(() => { void flushOrg(c.organizationId, id).catch(() => undefined); }, 500);
  (t as { unref?: () => void }).unref?.();
  return Response.json({ data: { id } }, { status: 202 });
});
