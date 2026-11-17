import { withUser } from "@sl/database";
import { ApiError, apiRoute } from "@/server/errors";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

// Profil sesi dan daftar organisasi milik pengguna (untuk pemilih organisasi). Tidak butuh organisasi aktif.
export function GET(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const session = await getSession(req);
    if (!session) {
      throw new ApiError(401, "UNAUTHENTICATED", "Belum masuk");
    }

    const memberships = await withUser(session.userId, (tx) =>
      tx.membership.findMany({
        where: { status: "ACTIVE" },
        include: { organization: { select: { id: true, name: true, slug: true, plan: true } } },
        orderBy: { createdAt: "asc" },
      }),
    );

    return Response.json({
      data: {
        userId: session.userId,
        activeOrganizationId: session.activeOrganizationId,
        organizations: memberships.map((m) => ({
          ...m.organization,
          role: m.role,
          allFarms: m.allFarms,
        })),
      },
    });
  });
}
