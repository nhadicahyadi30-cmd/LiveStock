import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/members -> anggota aktif organisasi (untuk memilih penanggung jawab tugas). Izin members.read.
export const GET = tenantRoute({ permission: "members.read" }, async (c) => {
  const rows = await c.tx.membership.findMany({
    where: { status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ data: rows.map((m) => ({ userId: m.user.id, name: m.user.name ?? m.user.email, role: m.role })) });
});
