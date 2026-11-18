import { canEditRecord } from "@sl/permissions";
import { uuid, voidRecord } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { clientIp, writeAudit } from "@/server/audit";
import { assertRecordFarmAccess } from "@/server/record-target";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/production-records/:id/void  -> membatalkan catatan (tidak dihapus). Izin records.create + aturan edit.
export const POST = tenantRoute<{ id: string }>({ permission: "records.create" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const { reason } = voidRecord.parse(await c.req.json());

  const record = await c.tx.productionRecord.findUnique({ where: { id } });
  if (!record) throw new ApiError(404, "NOT_FOUND", "Catatan tidak ditemukan");
  await assertRecordFarmAccess(c, { animalId: null, batchId: record.batchId });
  if (record.voidedAt) throw new ApiError(409, "ALREADY_VOIDED", "Catatan sudah dibatalkan");
  if (!canEditRecord({ role: c.role, userId: c.userId, recordedBy: record.recordedBy, createdAt: record.createdAt })) {
    throw new ApiError(403, "FORBIDDEN", "Anda tidak boleh membatalkan catatan ini");
  }

  const updated = await c.tx.productionRecord.update({
    where: { id },
    data: { voidedAt: new Date(), voidedBy: c.userId, voidReason: reason },
  });
  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "production_record.void", entityType: "production_record", entityId: id, after: { reason } },
  );
  return Response.json({ data: updated });
});
