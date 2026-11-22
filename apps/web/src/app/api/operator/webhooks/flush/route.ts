import { timingSafeEqual } from "node:crypto";
import { prisma } from "@sl/database";
import { flushOrg } from "@/server/webhooks";

export const dynamic = "force-dynamic";

// POST /api/operator/webhooks/flush (header x-operator-token) -> mengirim semua pengiriman webhook yang jatuh tempo.
// Jadwalkan tiap menit (cron/Task Scheduler) bila tidak memakai server Node yang selalu hidup.
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.BILLING_OPERATOR_TOKEN ?? "";
  if (secret.length < 24) return Response.json({ error: { code: "OPERATOR_DISABLED", message: "BILLING_OPERATOR_TOKEN belum diatur" } }, { status: 503 });
  const given = Buffer.from(req.headers.get("x-operator-token") ?? ""); const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return Response.json({ error: { code: "UNAUTHORIZED", message: "Token operator salah" } }, { status: 401 });
  // Operator tidak punya organisasi: kebijakan delivery_flush_lookup membuka baris PENDING hanya dalam transaksi yang menyalakan app.webhook_flush.
  const orgs = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.webhook_flush', 'on', true) AS f`;
    return tx.webhookDelivery.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: new Date() } }, distinct: ["organizationId"], select: { organizationId: true }, take: 200 });
  });
  let n = 0;
  for (const o of orgs) n += await flushOrg(o.organizationId);
  return Response.json({ data: { processed: n, organizations: orgs.length } });
}
