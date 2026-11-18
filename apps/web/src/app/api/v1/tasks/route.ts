import { taskCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { resolveTarget } from "@/server/record-target";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/tasks?scope=mine|all&status=OPEN|DONE  (izin tasks.read)
// Petugas hanya melihat tugas untuk dirinya atau yang belum ditugaskan; manajer ke atas bisa melihat semua.
export const GET = tenantRoute({ permission: "tasks.read" }, async (c) => {
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const mineOnly = url.searchParams.get("scope") === "mine" || c.role === "WORKER" || c.role === "VIEWER";

  const farmBatchIds = c.allowedFarmIds ? (await c.tx.livestockBatch.findMany({ where: { farmId: { in: c.allowedFarmIds } }, select: { id: true } })).map((b) => b.id) : null;

  const rows = await c.tx.task.findMany({
    where: {
      AND: [
        status === "OPEN" || status === "DONE" ? { status } : {},
        mineOnly ? { OR: [{ assignedTo: c.userId }, { assignedTo: null }] } : {},
        farmBatchIds ? { OR: [{ batchId: null }, { batchId: { in: farmBatchIds } }] } : {},
      ],
    },
    orderBy: [{ status: "asc" }, { dueOn: "asc" }, { id: "asc" }],
    take: 200,
  });

  const batchIds = [...new Set(rows.map((r) => r.batchId).filter((x): x is string => !!x))];
  const batches = batchIds.length ? await c.tx.livestockBatch.findMany({ where: { id: { in: batchIds } }, select: { id: true, code: true } }) : [];
  const code = new Map(batches.map((b) => [b.id, b.code]));
  return Response.json({ data: rows.map((r) => ({ ...r, batchCode: r.batchId ? (code.get(r.batchId) ?? null) : null })) });
});

// POST /api/v1/tasks  (izin tasks.manage). Penanggung jawab lain mendapat notifikasi.
export const POST = tenantRoute({ permission: "tasks.manage" }, async (c) => {
  const input = taskCreate.parse(await c.req.json());
  if (input.batchId) await resolveTarget(c, { batchId: input.batchId });

  if (input.assignedTo) {
    const m = await c.tx.membership.findUnique({ where: { organizationId_userId: { organizationId: c.organizationId, userId: input.assignedTo } } });
    if (!m || m.status !== "ACTIVE") throw new ApiError(422, "INVALID_ASSIGNEE", "Penanggung jawab bukan anggota aktif");
  }

  const task = await c.tx.task.create({ data: { ...input, organizationId: c.organizationId, createdBy: c.userId } });

  if (input.assignedTo && input.assignedTo !== c.userId) {
    await c.tx.notification.create({
      data: { organizationId: c.organizationId, userId: input.assignedTo, kind: "task.assigned", title: "Tugas baru untuk Anda", body: task.title, href: "/app/tugas" },
    });
  }
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "task.create", entityType: "task", entityId: task.id, after: { title: task.title } });
  return Response.json({ data: task }, { status: 201 });
});
