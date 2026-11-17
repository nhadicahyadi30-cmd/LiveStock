import { clearSessionCookie } from "@/server/cookies";
import { apiRoute } from "@/server/errors";

export const dynamic = "force-dynamic";

export function POST(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    const res = Response.json({ data: { ok: true } });
    clearSessionCookie(res);
    return res;
  });
}
