import { prisma } from "@sl/database";
import { z } from "zod";
import { newToken, RESET_TTL_MS, sendMail } from "@/server/auth-token";
import { clientIp } from "@/server/audit";
import { limitOrThrow } from "@/server/rate-limit";
import { apiRoute } from "@/server/errors";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

// POST /api/v1/auth/forgot -> selalu menjawab sama agar email terdaftar tidak bisa ditebak.
// Di luar produksi, tautan ikut dikembalikan supaya bisa dites tanpa layanan email.
export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    limitOrThrow(`forgot:ip:${clientIp(req) ?? "unknown"}`, 5, 60 * 60_000, "lupa sandi");
    const { email } = body.parse(await req.json());
    let devLink: string | undefined;
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
    if (user?.isActive) {
      const { token, hash } = newToken();
      await prisma.authToken.updateMany({ where: { email, kind: "RESET", usedAt: null }, data: { usedAt: new Date() } });
      await prisma.authToken.create({ data: { kind: "RESET", tokenHash: hash, email, expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
      const link = `${new URL(req.url).origin}/reset?token=${token}`;
      sendMail(email, "Atur ulang kata sandi Nusa Ternak", link);
      if (process.env.NODE_ENV !== "production") devLink = link;
    }
    return Response.json({ data: { ok: true, ...(devLink ? { devLink } : {}) } });
  });
}
