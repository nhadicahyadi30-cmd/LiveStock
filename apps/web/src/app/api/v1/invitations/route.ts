import { prisma } from "@sl/database";
import { z } from "zod";
import { clientIp, writeAudit } from "@/server/audit";
import { INVITE_TTL_MS, newToken } from "@/server/auth-token";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().toLowerCase().email().max(254), role: z.enum(["MANAGER", "WORKER", "VIEWER"]) });

// GET /api/v1/invitations -> undangan yang belum dipakai dan belum kedaluwarsa
export const GET = tenantRoute({ permission: "members.manage" }, async (c) => {
  const rows = await prisma.authToken.findMany({ where: { kind: "INVITE", targetOrgId: c.organizationId, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, role: true, expiresAt: true } });
  return Response.json({ data: rows });
});

// POST /api/v1/invitations -> membuat tautan undangan. Tautan dikembalikan ke pengundang untuk dibagikan (mis. lewat WhatsApp).
export const POST = tenantRoute({ permission: "members.manage" }, async (c) => {
  const input = body.parse(await c.req.json());
  const existing = await c.tx.membership.findFirst({ where: { status: "ACTIVE", user: { email: input.email } } });
  if (existing) throw new ApiError(409, "ALREADY_MEMBER", "Orang ini sudah menjadi anggota");
  const { token, hash } = newToken();
  await prisma.authToken.updateMany({ where: { kind: "INVITE", email: input.email, targetOrgId: c.organizationId, usedAt: null }, data: { usedAt: new Date() } });
  const row = await prisma.authToken.create({ data: { kind: "INVITE", tokenHash: hash, email: input.email, targetOrgId: c.organizationId, role: input.role, invitedBy: c.userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "invitation.create", entityType: "invitation", entityId: row.id, after: { email: input.email, role: input.role } });
  return Response.json({ data: { id: row.id, email: input.email, role: input.role, link: `${new URL(c.req.url).origin}/undangan?token=${token}` } }, { status: 201 });
});
