import { z } from "zod";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

const body = z.object({ id: z.string().uuid().optional() });

// POST /api/v1/notifications/read -> tandai satu (id) atau semua notifikasi milik pengguna sebagai dibaca.
export const POST = tenantRoute({ permission: "dashboard.read" }, async (c) => {
  const { id } = body.parse(await c.req.json().catch(() => ({})));
  const res = await c.tx.notification.updateMany({ where: { userId: c.userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  return Response.json({ data: { updated: res.count } });
});
