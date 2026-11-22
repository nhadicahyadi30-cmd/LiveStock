import { uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/vet/consultations/:id/close -> peternak atau dokter menutup konsultasi
export const POST = tenantRoute<{ id: string }>({ permission: "records.create" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const r = await c.tx.vetConsultation.findUnique({ where: { id } });
  if (!r) throw new ApiError(404, "NOT_FOUND", "Konsultasi tidak ditemukan");
  if (r.status === "CLOSED") return Response.json({ data: { id, status: "CLOSED" } });
  await c.tx.vetConsultation.update({ where: { id }, data: { status: "CLOSED" } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "vet_consultation.close", entityType: "vet_consultation", entityId: id });
  return Response.json({ data: { id, status: "CLOSED" } });
});
