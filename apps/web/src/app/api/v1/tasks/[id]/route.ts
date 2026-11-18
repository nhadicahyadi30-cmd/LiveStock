import { can } from "@sl/permissions";
import { taskUpdate, uuid } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// PATCH /api/v1/tasks/:id
//  - status: izin tasks.complete (petugas hanya untuk tugas yang ditugaskan ke dirinya atau belum ditugaskan)
//  - judul, tanggal, penanggung jawab: izin tasks.manage
export const PATCH = tenantRoute<{ id: string }>({ permission: "tasks.complete" }, async (c) => {
  const id = uuid.parse(c.params.id);
  const input = taskUpdate.parse(await c.req.json());

  const task = await c.tx.task.findUnique({ where: { id } });
  if (!task) throw new ApiError(404, "NOT_FOUND", "Tugas tidak ditemukan");

  const manage = can(c.role, "tasks.manage");
  const editsFields = input.title !== undefined || input.description !== undefined || input.dueOn !== undefined || input.assignedTo !== undefined;
  if (editsFields && !manage) throw new ApiError(403, "FORBIDDEN", "Role Anda tidak boleh mengubah isi tugas");
  if (!manage && task.assignedTo !== null && task.assignedTo !== c.userId) throw new ApiError(403, "FORBIDDEN", "Tugas ini bukan untuk Anda");

  const done = input.status === "DONE";
  const updated = await c.tx.task.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dueOn !== undefined ? { dueOn: input.dueOn } : {}),
      ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
      ...(input.status !== undefined ? { status: input.status, completedAt: done ? new Date() : null, completedBy: done ? c.userId : null } : {}),
    },
  });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "task.update", entityType: "task", entityId: id, after: { status: updated.status } });
  return Response.json({ data: updated });
});
