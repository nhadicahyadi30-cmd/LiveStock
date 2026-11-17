import { ApiError } from "./errors";
import { assertFarmAccess } from "./farm-access";
import type { TenantRequestContext } from "./tenant-guard";

/**
 * Memastikan ternak atau batch tujuan ada (RLS menyaring tenant lain), masih aktif,
 * dan berada di farm yang boleh diakses pengguna.
 */
export async function resolveTarget(
  c: TenantRequestContext<unknown>,
  target: { animalId?: string | undefined; batchId?: string | undefined },
): Promise<void> {
  if (target.animalId) {
    const animal = await c.tx.animal.findUnique({
      where: { organizationId_id: { organizationId: c.organizationId, id: target.animalId } },
      select: { farmId: true },
    });
    if (!animal) throw new ApiError(404, "NOT_FOUND", "Ternak tidak ditemukan");
    assertFarmAccess(c, animal.farmId);
  } else if (target.batchId) {
    const batch = await c.tx.livestockBatch.findUnique({
      where: { organizationId_id: { organizationId: c.organizationId, id: target.batchId } },
      select: { farmId: true, status: true },
    });
    if (!batch) throw new ApiError(404, "NOT_FOUND", "Batch tidak ditemukan");
    assertFarmAccess(c, batch.farmId);
    if (batch.status !== "ACTIVE") throw new ApiError(409, "BATCH_CLOSED", "Batch sudah ditutup");
  }
}

/**
 * Untuk koreksi (void): batch yang sudah ditutup tetap boleh dikoreksi, jadi hanya akses farm yang diperiksa.
 */
export async function assertRecordFarmAccess(
  c: TenantRequestContext<unknown>,
  r: { animalId: string | null; batchId: string | null },
): Promise<void> {
  const farmId = r.animalId
    ? (await c.tx.animal.findUnique({ where: { id: r.animalId }, select: { farmId: true } }))?.farmId
    : r.batchId
      ? (await c.tx.livestockBatch.findUnique({ where: { id: r.batchId }, select: { farmId: true } }))?.farmId
      : undefined;
  if (!farmId) throw new ApiError(404, "NOT_FOUND", "Catatan tidak ditemukan");
  assertFarmAccess(c, farmId);
}
