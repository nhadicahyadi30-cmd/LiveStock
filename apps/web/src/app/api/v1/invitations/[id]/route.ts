import { prisma } from "@sl/database";
import { uuid } from "@sl/validation";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// DELETE /api/v1/invitations/:id -> mencabut undangan
export const DELETE = tenantRoute<{ id: string }>({ permission: "members.manage" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const res = await prisma.authToken.updateMany({ where: { id, kind: "INVITE", targetOrgId: c.organizationId, usedAt: null }, data: { usedAt: new Date() } });
  return Response.json({ data: { revoked: res.count } });
});
