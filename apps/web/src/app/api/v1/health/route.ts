import { prisma } from "@sl/database";
import { apiRoute } from "@/server/errors";

export const dynamic = "force-dynamic";

// Endpoint publik untuk pemantauan. Tidak membuka data apa pun selain status.
export function GET(req: Request): Promise<Response> {
  return apiRoute(req, async () => {
    let db: "ok" | "error" = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "error";
    }

    return Response.json(
      { status: db === "ok" ? "ok" : "degraded", db, time: new Date().toISOString() },
      { status: db === "ok" ? 200 : 503 },
    );
  });
}
