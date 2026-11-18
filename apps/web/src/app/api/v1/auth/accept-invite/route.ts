import { hashPassword, prisma, verifyPassword, withTenant } from "@sl/database";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashToken } from "@/server/auth-token";
import { setSessionCookie } from "@/server/cookies";
import { ApiError, apiRoute } from "@/server/errors";

export const dynamic = "force-dynamic";

const body = z.object({ token: z.string().min(20).max(200), name: z.string().trim().min(2).max(100).optional(), password: z.string().min(8, "Kata sandi minimal 8 karakter").max(200) });

async function findInvite(token: string) {
  const t = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!t || t.kind !== "INVITE" || t.usedAt || t.expiresAt < new Date() || !t.targetOrgId || !t.role) {
    throw new ApiError(410, "INVITE_INVALID", "Undangan tidak berlaku atau sudah kedaluwarsa");
  }
  return t;
}

// GET /api/v1/auth/accept-invite?token= -> info undangan untuk ditampilkan (email, apakah sudah punya akun)
export function GET(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const t = await findInvite(new URL(req.url).searchParams.get("token") ?? "");
    const exists = !!(await prisma.user.findUnique({ where: { email: t.email }, select: { id: true } }));
    return Response.json({ data: { email: t.email, role: t.role, hasAccount: exists } });
  });
}

// POST /api/v1/auth/accept-invite -> pengguna baru dibuat; pengguna lama harus memasukkan kata sandinya.
export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const input = body.parse(await req.json());
    const t = await findInvite(input.token);
    let user = await prisma.user.findUnique({ where: { email: t.email } });
    if (user) {
      if (!(await verifyPassword(input.password, user.passwordHash)) || !user.isActive) throw new ApiError(401, "INVALID_CREDENTIALS", "Kata sandi salah");
    } else {
      if (!input.name) throw new ApiError(422, "VALIDATION_ERROR", "Nama wajib diisi");
      user = await prisma.user.create({ data: { id: randomUUID(), email: t.email, name: input.name, passwordHash: await hashPassword(input.password), emailVerifiedAt: new Date() } });
    }
    const orgId = t.targetOrgId!;
    const claimed = await prisma.authToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) throw new ApiError(410, "INVITE_INVALID", "Undangan sudah dipakai");
    await withTenant({ organizationId: orgId, userId: user.id }, (tx) =>
      tx.membership.upsert({
        where: { organizationId_userId: { organizationId: orgId, userId: user!.id } },
        update: { role: t.role!, status: "ACTIVE" },
        create: { organizationId: orgId, userId: user!.id, role: t.role!, status: "ACTIVE" },
      }),
    );
    const res = Response.json({ data: { userId: user.id, activeOrganizationId: orgId } });
    setSessionCookie(res, { userId: user.id, organizationId: orgId });
    return res;
  });
}
