import { uuid, vetMessageCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/vet/consultations/:id/messages -> balasan dari peternak atau dokter. Balasan dokter mengubah status jadi ANSWERED, balasan peternak membukanya lagi.
export const POST = tenantRoute<{ id: string }>({ permission: "records.create" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const { body } = vetMessageCreate.parse(await c.req.json());
  const r = await c.tx.vetConsultation.findUnique({ where: { id } });
  if (!r) throw new ApiError(404, "NOT_FOUND", "Konsultasi tidak ditemukan");
  if (r.status === "CLOSED") throw new ApiError(409, "CLOSED", "Konsultasi sudah ditutup");
  const isVet = r.vetOrgId === c.organizationId;
  await c.tx.vetMessage.create({ data: { consultationId: id, farmOrgId: r.farmOrgId, vetOrgId: r.vetOrgId, authorOrgId: c.organizationId, authorUserId: c.userId, body } });
  await c.tx.vetConsultation.update({ where: { id }, data: { status: isVet ? "ANSWERED" : "OPEN" } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "vet_message.create", entityType: "vet_consultation", entityId: id });
  return Response.json({ data: { id } }, { status: 201 });
});
