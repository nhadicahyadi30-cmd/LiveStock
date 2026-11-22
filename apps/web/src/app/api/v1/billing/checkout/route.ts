import { randomInt } from "node:crypto";
import { checkoutCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { PLANS, planPrice } from "@/server/plans";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/billing/checkout { plan, months } -> membuat tagihan (PENDING). Paket aktif setelah operator mengonfirmasi pembayaran.
export const POST = tenantRoute({ permission: "members.manage" }, async (c) => {
  const input = checkoutCreate.parse(await c.req.json());
  const open = await c.tx.subscriptionInvoice.count({ where: { status: "PENDING" } });
  if (open >= 3) throw new ApiError(409, "TOO_MANY_PENDING", "Masih ada tagihan yang belum dibayar. Bayar atau batalkan dulu.");
  const now = new Date();
  const number = `SUB-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${randomInt(10000, 99999)}`;
  const dueOn = new Date(now.getTime() + 7 * 864e5);
  const row = await c.tx.subscriptionInvoice.create({ data: { organizationId: c.organizationId, number, plan: input.plan, months: input.months, amount: planPrice(input.plan, input.months), dueOn, createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "subscription_invoice.create", entityType: "subscription_invoice", entityId: row.id, after: { plan: PLANS[input.plan].name, months: input.months, number } });
  return Response.json({ data: { id: row.id, number } }, { status: 201 });
});
