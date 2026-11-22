import { vetConsultationCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/vet/consultations?role=ask|answer -> konsultasi yang saya ajukan / yang masuk ke saya (sebagai dokter)
export const GET = tenantRoute({ permission: "records.read" }, async (c) => {
  const role = new URL(c.req.url).searchParams.get("role") === "answer" ? "answer" : "ask";
  const rows = await c.tx.vetConsultation.findMany({ where: role === "answer" ? { vetOrgId: c.organizationId } : { farmOrgId: c.organizationId }, orderBy: { updatedAt: "desc" }, take: 100 });
  const vets = role === "ask" ? await c.tx.vetProfile.findMany({ where: { orgId: { in: [...new Set(rows.map((r) => r.vetOrgId))] } } }) : [];
  const nameOf = (r: (typeof rows)[number]) => (role === "answer" ? r.farmName : vets.find((v) => v.orgId === r.vetOrgId)?.displayName) ?? "-";
  return Response.json({ data: rows.map((r) => ({ id: r.id, subject: r.subject, species: r.species, status: r.status, updatedAt: r.updatedAt, counterparty: nameOf(r) })) });
});

// POST /api/v1/vet/consultations -> peternak mengajukan konsultasi ke dokter hewan terpilih
export const POST = tenantRoute({ permission: "records.create" }, async (c) => {
  const input = vetConsultationCreate.parse(await c.req.json());
  const vet = await c.tx.vetProfile.findUnique({ where: { orgId: input.vetOrgId } });
  if (!vet || !vet.accepting) throw new ApiError(404, "NOT_FOUND", "Dokter hewan tidak ditemukan atau sedang tidak menerima konsultasi");
  if (vet.orgId === c.organizationId) throw new ApiError(400, "BAD_REQUEST", "Tidak bisa berkonsultasi ke diri sendiri");
  const farm = await c.tx.organization.findUnique({ where: { id: c.organizationId }, select: { name: true } });
  const row = await c.tx.vetConsultation.create({ data: { farmOrgId: c.organizationId, vetOrgId: vet.orgId, farmName: farm?.name ?? "Peternakan", subject: input.subject, species: input.species, symptoms: input.symptoms, createdBy: c.userId } });
  await c.tx.vetMessage.create({ data: { consultationId: row.id, farmOrgId: c.organizationId, vetOrgId: vet.orgId, authorOrgId: c.organizationId, authorUserId: c.userId, body: input.symptoms } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "vet_consultation.create", entityType: "vet_consultation", entityId: row.id, after: { vetOrgId: vet.orgId } });
  return Response.json({ data: { id: row.id } }, { status: 201 });
});
