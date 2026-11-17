// Tenant guard: pintu masuk wajib untuk setiap endpoint yang menyentuh data organisasi.
//
// Urutan pemeriksaan (semuanya di server):
//   1. Sesi valid                         -> 401 UNAUTHENTICATED
//   2. Ada organisasi aktif di sesi       -> 400 NO_ACTIVE_ORGANIZATION
//   3. Pengguna anggota AKTIF organisasi  -> 403 NOT_A_MEMBER   (diverifikasi ke database, bukan dari klien)
//   4. Role punya izin yang dibutuhkan    -> 403 FORBIDDEN
//   5. Handler berjalan di dalam transaksi dengan konteks tenant (RLS aktif) -> withTenant()
//
// organization_id tidak pernah dibaca dari body, query, atau header request biasa.
import { withTenant, withUser, type Tx } from "@sl/database";
import { can, type Permission, type Role } from "@sl/permissions";
import { ApiError, apiRoute } from "./errors";
import { getSession } from "./session";

export interface TenantRequestContext<P> {
  req: Request;
  requestId: string;
  params: P;
  userId: string;
  organizationId: string;
  membershipId: string;
  role: Role;
  /** null = akses semua farm; array = hanya farm yang ditugaskan (memberships.all_farms = false). */
  allowedFarmIds: string[] | null;
  /** Transaksi dengan konteks tenant terpasang. Semua query data harus lewat objek ini. */
  tx: Tx;
}

interface RouteContext<P> {
  params: Promise<P>;
}

export function tenantRoute<P = Record<string, never>>(
  options: { permission: Permission },
  handler: (ctx: TenantRequestContext<P>) => Promise<Response>,
): (req: Request, routeCtx: RouteContext<P>) => Promise<Response> {
  return (req, routeCtx) =>
    apiRoute(req, async (requestId) => {
      const session = await getSession(req);
      if (!session) {
        throw new ApiError(401, "UNAUTHENTICATED", "Belum masuk");
      }
      if (!session.activeOrganizationId) {
        throw new ApiError(400, "NO_ACTIVE_ORGANIZATION", "Pilih organisasi aktif terlebih dahulu");
      }

      const organizationId = session.activeOrganizationId;
      const userId = session.userId;

      // Keanggotaan dibaca lewat konteks pengguna: policy memberships mengizinkan baris milik pengguna sendiri.
      const membership = await withUser(userId, (tx) =>
        tx.membership.findUnique({
          where: { organizationId_userId: { organizationId, userId } },
        }),
      );

      if (!membership || membership.status !== "ACTIVE") {
        throw new ApiError(403, "NOT_A_MEMBER", "Anda bukan anggota aktif organisasi ini");
      }
      if (!can(membership.role, options.permission)) {
        throw new ApiError(403, "FORBIDDEN", "Role Anda tidak memiliki izin untuk tindakan ini");
      }

      const params = (await routeCtx?.params) ?? ({} as P);

      return withTenant({ organizationId, userId }, async (tx) => {
        let allowedFarmIds: string[] | null = null;
        if (!membership.allFarms) {
          const rows = await tx.membershipFarm.findMany({
            where: { membershipId: membership.id },
            select: { farmId: true },
          });
          allowedFarmIds = rows.map((r) => r.farmId);
        }

        return handler({
          req,
          requestId,
          params,
          userId,
          organizationId,
          membershipId: membership.id,
          role: membership.role,
          allowedFarmIds,
          tx,
        });
      });
    });
}
