import { apiKeyCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { newApiKey } from "@/server/api-keys";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/integrations/keys -> daftar kunci (tanpa nilai kunci)
export const GET = tenantRoute({ permission: "members.manage" }, async (c) => {
  const rows = await c.tx.apiKey.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return Response.json({ data: rows.map((k) => ({ id: k.id, name: k.name, prefix: k.keyPrefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, revokedAt: k.revokedAt })) });
});

// POST /api/v1/integrations/keys -> membuat kunci. Nilai kunci HANYA ditampilkan sekali di respons ini.
export const POST = tenantRoute({ permission: "members.manage" }, async (c) => {
  const { name } = apiKeyCreate.parse(await c.req.json());
  if ((await c.tx.apiKey.count({ where: { revokedAt: null } })) >= 10) throw new ApiError(409, "LIMIT", "Maksimal 10 kunci aktif. Cabut yang tidak dipakai.");
  const { key, hash, prefix } = newApiKey();
  const row = await c.tx.apiKey.create({ data: { organizationId: c.organizationId, name, keyHash: hash, keyPrefix: prefix, createdBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "api_key.create", entityType: "api_key", entityId: row.id, after: { name } });
  return Response.json({ data: { id: row.id, name, key } }, { status: 201 });
});
