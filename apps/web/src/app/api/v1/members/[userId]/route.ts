import { uuid } from "@sl/validation";
import { z } from "zod";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

const body = z.object({ role: z.enum(["MANAGER", "WORKER", "VIEWER"]).optional(), remove: z.boolean().optional() }).refine((v) => v.role !== undefined || v.remove, { message: "Tidak ada perubahan" });

// PATCH /api/v1/members/:userId -> ubah peran atau keluarkan anggota (izin members.manage).
// Pemilik dan diri sendiri tidak bisa diubah lewat sini.
export const PATCH = tenantRoute<{ userId: string }>({ permission: "members.manage" }, async (c) => {
  const userId = uuid.parse(c.params.userId);
  const input = body.parse(await c.req.json());
  if (userId === c.userId) throw new ApiError(422, "SELF_CHANGE", "Anda tidak bisa mengubah akun sendiri");
  const m = await c.tx.membership.findUnique({ where: { organizationId_userId: { organizationId: c.organizationId, userId } } });
  if (!m || m.status !== "ACTIVE") throw new ApiError(404, "NOT_FOUND", "Anggota tidak ditemukan");
  if (m.role === "OWNER") throw new ApiError(403, "FORBIDDEN", "Pemilik tidak bisa diubah");
  if (c.role === "MANAGER" && (input.role === "MANAGER" || m.role === "MANAGER")) throw new ApiError(403, "FORBIDDEN", "Hanya pemilik yang boleh menjadikan manajer");
  const updated = await c.tx.membership.update({ where: { id: m.id }, data: input.remove ? { status: "SUSPENDED" } : { role: input.role! } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: input.remove ? "member.remove" : "member.role", entityType: "membership", entityId: m.id, before: { role: m.role }, after: { role: updated.role, status: updated.status } });
  return Response.json({ data: { userId, role: updated.role, status: updated.status } });
});
