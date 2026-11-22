import { hashPassword, prisma, withTenant } from "@sl/database";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { setSessionCookie } from "@/server/cookies";
import { clientIp } from "@/server/audit";
import { limitOrThrow } from "@/server/rate-limit";
import { ApiError, apiRoute } from "@/server/errors";

export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(200),
  organizationName: z.string().trim().min(2).max(120),
});
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "usaha";

// POST /api/v1/auth/register -> membuat akun + organisasi baru (pendaftar menjadi OWNER) lalu masuk.
export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    limitOrThrow(`register:ip:${clientIp(req) ?? "unknown"}`, 10, 60 * 60_000, "pendaftaran");
    const input = body.parse(await req.json());
    if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      throw new ApiError(409, "EMAIL_TAKEN", "Email ini sudah terdaftar. Silakan masuk.");
    }
    const userId = randomUUID();
    const organizationId = randomUUID();
    await prisma.user.create({ data: { id: userId, email: input.email, name: input.name, passwordHash: await hashPassword(input.password) } });
    await withTenant({ organizationId, userId }, async (tx) => {
      await tx.organization.create({ data: { id: organizationId, name: input.organizationName, slug: `${slugify(input.organizationName)}-${randomBytes(3).toString("hex")}` } });
      await tx.membership.create({ data: { organizationId, userId, role: "OWNER", status: "ACTIVE" } });
    });
    const res = Response.json({ data: { userId, activeOrganizationId: organizationId } }, { status: 201 });
    setSessionCookie(res, { userId, organizationId });
    return res;
  });
}
