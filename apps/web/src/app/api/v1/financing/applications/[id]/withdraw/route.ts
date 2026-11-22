import { uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { requireFullAccess } from "@/server/finance";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/financing/applications/:id/withdraw -> menarik pengajuan yang belum diputuskan
export const POST = tenantRoute<{ id: string }>({ permission: "finance.manage" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  const id = uuid.parse(c.params.id);
  const upd = await c.tx.financingApplication.updateMany({ where: { id, status: { in: ["SUBMITTED", "IN_REVIEW"] } }, data: { status: "WITHDRAWN" } });
  if (upd.count === 0) throw new ApiError(409, "INVALID_TRANSITION", "Pengajuan sudah diputuskan atau tidak ditemukan");
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "financing_application.withdraw", entityType: "financing_application", entityId: id });
  return Response.json({ data: { id } });
});
