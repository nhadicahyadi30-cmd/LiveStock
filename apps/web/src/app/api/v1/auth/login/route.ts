import { prisma, verifyPassword, withUser } from "@sl/database";
import { z } from "zod";
import { setSessionCookie } from "@/server/cookies";
import { clientIp } from "@/server/audit";
import { ApiError, apiRoute } from "@/server/errors";
import { limitOrThrow, resetKey } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) });

// POST /api/v1/auth/login -> mengatur cookie sesi. Pesan galat sama untuk email salah dan kata sandi salah.
// Pembatas: 8 percobaan gagal per email per 15 menit, 40 per IP per 15 menit (IP dari X-Forwarded-For; hanya dapat dipercaya di belakang proxy tepercaya).
export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const { email, password } = body.parse(await req.json());
    const ip = clientIp(req) ?? "unknown";
    const emailKey = `login:e:${email}`;
    limitOrThrow(`login:ip:${ip}`, 40, 15 * 60_000, "masuk");
    limitOrThrow(emailKey, 8, 15 * 60_000, "masuk");

    const user = await prisma.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, user?.passwordHash);
    if (!user || !ok || !user.isActive) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email atau kata sandi salah");
    }

    resetKey(emailKey);
    const memberships = await withUser(user.id, (tx) =>
      tx.membership.findMany({
        where: { status: "ACTIVE" },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    );
    // Organisasi aktif awal: yang pertama. Pengguna bisa pindah lewat /auth/switch-org.
    const activeOrganizationId = memberships[0]?.organizationId ?? null;

    const res = Response.json({
      data: {
        userId: user.id,
        name: user.name,
        activeOrganizationId,
        organizations: memberships.map((m) => ({ id: m.organization.id, name: m.organization.name, role: m.role })),
      },
    });
    setSessionCookie(res, { userId: user.id, organizationId: activeOrganizationId });
    return res;
  });
}
