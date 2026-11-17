import { prisma, verifyPassword, withUser } from "@sl/database";
import { z } from "zod";
import { setSessionCookie } from "@/server/cookies";
import { ApiError, apiRoute } from "@/server/errors";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) });

// POST /api/v1/auth/login -> mengatur cookie sesi. Pesan galat sama untuk email salah dan kata sandi salah.
// TODO: pembatasan percobaan (rate limit) sebelum dipakai publik.
export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const { email, password } = body.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, user?.passwordHash);
    if (!user || !ok || !user.isActive) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email atau kata sandi salah");
    }

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
