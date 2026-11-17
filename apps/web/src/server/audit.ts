import type { Prisma, Tx } from "@sl/database";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

/**
 * Mencatat aksi penting ke audit_logs dalam transaksi yang sama dengan perubahannya,
 * sehingga catatan audit dan data tidak pernah berbeda. audit_logs hanya bisa INSERT dan SELECT.
 */
export async function writeAudit(
  tx: Tx,
  ctx: { organizationId: string; actorId: string; ipAddress?: string | null },
  entry: AuditEntry,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
      ipAddress: ctx.ipAddress ?? null,
    },
  });
}

/** Alamat IP klien dari header proxy (diisi oleh infrastruktur, bukan dipercaya untuk otorisasi). */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null;
}
