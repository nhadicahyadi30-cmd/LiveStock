import { hashPassword, prisma } from "@sl/database";
import { z } from "zod";
import { hashToken } from "@/server/auth-token";
import { ApiError, apiRoute } from "@/server/errors";

export const dynamic = "force-dynamic";

const body = z.object({ token: z.string().min(20).max(200), password: z.string().min(8, "Kata sandi minimal 8 karakter").max(200) });

// POST /api/v1/auth/reset -> token sekali pakai, berlaku 1 jam.
export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const { token, password } = body.parse(await req.json());
    const t = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!t || t.kind !== "RESET" || t.usedAt || t.expiresAt < new Date()) throw new ApiError(410, "RESET_INVALID", "Tautan tidak berlaku atau sudah kedaluwarsa");
    const claimed = await prisma.authToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) throw new ApiError(410, "RESET_INVALID", "Tautan sudah dipakai");
    await prisma.user.update({ where: { email: t.email }, data: { passwordHash: await hashPassword(password) } });
    return Response.json({ data: { ok: true } });
  });
}
