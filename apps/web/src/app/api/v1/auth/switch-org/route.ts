import { withUser } from "@sl/database";
import { uuid } from "@sl/validation";
import { z } from "zod";
import { setSessionCookie } from "@/server/cookies";
import { ApiError, apiRoute } from "@/server/errors";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

const body = z.object({ organizationId: uuid });

// POST /api/v1/auth/switch-org -> pindah organisasi aktif; keanggotaan diverifikasi di database.
export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const session = await getSession(req);
    if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Belum masuk");
    const { organizationId } = body.parse(await req.json());

    const m = await withUser(session.userId, (tx) =>
      tx.membership.findUnique({ where: { organizationId_userId: { organizationId, userId: session.userId } } }),
    );
    if (!m || m.status !== "ACTIVE") throw new ApiError(403, "NOT_A_MEMBER", "Anda bukan anggota aktif organisasi ini");

    const res = Response.json({ data: { activeOrganizationId: organizationId } });
    setSessionCookie(res, { userId: session.userId, organizationId });
    return res;
  });
}
