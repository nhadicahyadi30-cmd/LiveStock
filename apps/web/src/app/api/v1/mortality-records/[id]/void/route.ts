import { canEditRecord } from "@sl/permissions";
import { uuid, voidRecord } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { clientIp, writeAudit } from "@/server/audit";
import { assertRecordFarmAccess } from "@/server/record-target";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/mortality-records/:id/void  -> membatalkan catatan (tidak dihapus). Izin records.create + aturan edit.
export const POST = tenantRoute<{ id: string }>({ permission: "records.create" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const { reason } = voidRecord.parse(await c.req.json());

  const record = await c.tx.mortalityRecord.findUnique({ where: { id } });
  if (!record) throw new ApiError(404, "NOT_FOUND", "Catatan tidak ditemukan");
  await assertRecordFarmAccess(c, record);
  if (record.voidedAt) throw new ApiError(409, "ALREADY_VOIDED", "Catatan sudah dibatalkan");
  if (!canEditRecord({ role: c.role, userId: c.userId, recordedBy: record.recordedBy, createdAt: record.createdAt })) {
    throw new ApiError(403, "FORBIDDEN", "Anda tidak boleh membatalkan catatan ini");
  }

  const updated = await c.tx.mortalityRecord.update({
    where: { id },
    data: { voidedAt: new Date(), voidedBy: c.userId, voidReason: reason },
  });
  // Jika ternak individual ini tidak punya catatan kematian aktif lain, status dikembalikan ke ACTIVE.
  if (record.animalId) {
    const others = await c.tx.mortalityRecord.count({
      where: { animalId: record.animalId, voidedAt: null, id: { not: id } },
    });
    if (others === 0) {
      await c.tx.animal.updateMany({ where: { id: record.animalId, status: "DEAD" }, data: { status: "ACTIVE" } });
    }
  }
  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "mortality_record.void", entityType: "mortality_record", entityId: id, after: { reason } },
  );
  return Response.json({ data: updated });
});
