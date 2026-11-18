import { healthRecordComplete, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { assertRecordFarmAccess } from "@/server/record-target";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/health-records/:id/complete -> vaksinasi dilakukan / pengobatan atau karantina selesai
export const POST = tenantRoute<{ id: string }>({ permission: "records.create" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const { doneOn } = healthRecordComplete.parse(await c.req.json().catch(() => ({})));
  const r = await c.tx.healthRecord.findUnique({ where: { id } });
  if (!r || r.voidedAt) throw new ApiError(404, "NOT_FOUND", "Catatan tidak ditemukan");
  await assertRecordFarmAccess(c, { animalId: null, batchId: r.batchId });
  if (r.status === "DONE") throw new ApiError(409, "ALREADY_DONE", "Catatan sudah selesai");
  const when = doneOn ?? new Date();
  if (r.kind !== "VACCINATION" && when < r.eventOn) throw new ApiError(422, "VALIDATION_ERROR", "Tanggal selesai tidak boleh sebelum tanggal mulai");
  if (when.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new ApiError(422, "VALIDATION_ERROR", "Tanggal selesai tidak boleh di masa depan");

  const updated = await c.tx.healthRecord.update({ where: { id }, data: { status: "DONE", doneOn: when } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "health_record.complete", entityType: "health_record", entityId: id });
  return Response.json({ data: updated });
});
