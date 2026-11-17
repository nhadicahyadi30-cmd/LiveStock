import { ApiError } from "./errors";
import type { TenantRequestContext } from "./tenant-guard";

type Ctx = Pick<TenantRequestContext<unknown>, "allowedFarmIds">;

/**
 * Anggota yang dibatasi per farm hanya boleh menyentuh farm yang ditugaskan.
 * Memakai 404 (bukan 403) agar keberadaan data di farm lain tidak bocor.
 */
export function assertFarmAccess(c: Ctx, farmId: string): void {
  if (c.allowedFarmIds && !c.allowedFarmIds.includes(farmId)) {
    throw new ApiError(404, "NOT_FOUND", "Data tidak ditemukan");
  }
}
