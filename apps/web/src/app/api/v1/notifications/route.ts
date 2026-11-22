import { ensureHealthReminders } from "@/server/health-reminders";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/notifications -> notifikasi milik pengguna (terbaru dulu) dan jumlah yang belum dibaca.
// Tidak butuh izin khusus: hanya baris milik pengguna yang dibaca.
export const GET = tenantRoute({ permission: "dashboard.read" }, async (c) => {
  await ensureHealthReminders(c.tx, { organizationId: c.organizationId, userId: c.userId, allowedFarmIds: c.allowedFarmIds });
  const [rows, unread] = await Promise.all([
    c.tx.notification.findMany({ where: { userId: c.userId }, orderBy: { id: "desc" }, take: 20 }),
    c.tx.notification.count({ where: { userId: c.userId, readAt: null } }),
  ]);
  return Response.json({ data: rows, unread });
});
