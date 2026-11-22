import { uuid } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/vet/consultations/:id -> detail + percakapan (peserta saja, dijaga RLS)
export const GET = tenantRoute<{ id: string }>({ permission: "records.read" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const r = await c.tx.vetConsultation.findUnique({ where: { id } });
  if (!r) throw new ApiError(404, "NOT_FOUND", "Konsultasi tidak ditemukan");
  const msgs = await c.tx.vetMessage.findMany({ where: { consultationId: id }, orderBy: { createdAt: "asc" }, take: 500 });
  return Response.json({ data: { id: r.id, subject: r.subject, species: r.species, status: r.status, side: r.farmOrgId === c.organizationId ? "farm" : "vet", messages: msgs.map((m) => ({ id: m.id, mine: m.authorOrgId === c.organizationId, fromVet: m.authorOrgId === r.vetOrgId, body: m.body, createdAt: m.createdAt })) } });
});
