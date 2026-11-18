import { invoiceCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { assertBatchExists, requireFullAccess, ym } from "@/server/finance";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/finance/invoices?status=OPEN|PAID|VOID
export const GET = tenantRoute({ permission: "finance.read" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const status = (["OPEN", "PAID", "VOID"] as const).find((s) => s === new URL(c.req.url).searchParams.get("status"));
  const rows = await c.tx.invoice.findMany({ where: status ? { status } : {}, orderBy: [{ issueOn: "desc" }, { number: "desc" }], take: 200 });
  return Response.json({ data: rows.map((r) => ({ ...r, amount: Number(r.amount) })) });
});

// POST /api/v1/finance/invoices -> nomor otomatis INV-YYYYMM-001
export const POST = tenantRoute({ permission: "finance.manage" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const input = invoiceCreate.parse(await c.req.json());
  if (input.batchId) await assertBatchExists(c.tx, c.organizationId, input.batchId);
  const prefix = `INV-${ym(input.issueOn).replace("-", "")}-`;
  const last = await c.tx.invoice.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  const row = await c.tx.invoice.create({ data: { ...input, number: `${prefix}${String(seq).padStart(3, "0")}`, organizationId: c.organizationId, createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "invoice.create", entityType: "invoice", entityId: row.id, after: { number: row.number, amount: Number(row.amount) } });
  return Response.json({ data: { ...row, amount: Number(row.amount) } }, { status: 201 });
});
