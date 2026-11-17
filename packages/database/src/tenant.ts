import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type Tx = Prisma.TransactionClient;

export interface TenantContext {
  /** Organisasi aktif. Harus berasal dari sesi dan keanggotaan yang sudah divalidasi, bukan dari body request. */
  organizationId: string;
  userId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, name: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`${name} bukan UUID yang valid`);
  }
}

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;

/**
 * Menjalankan `fn` dalam satu transaksi dengan konteks tenant terpasang.
 * set_config(..., true) membuat nilainya lokal pada transaksi, sehingga aman dengan connection pooling
 * dan tidak bocor ke request lain.
 */
export async function withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  assertUuid(ctx.organizationId, "organizationId");
  assertUuid(ctx.userId, "userId");

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.organization_id', ${ctx.organizationId}, true) AS org, set_config('app.user_id', ${ctx.userId}, true) AS usr`;
    return fn(tx);
  }, TX_OPTIONS);
}

/**
 * Konteks pengguna tanpa organisasi aktif. Dipakai untuk memuat daftar keanggotaan/organisasi milik pengguna
 * (misalnya saat login). Tabel bertenant lain tetap tidak terbaca.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  assertUuid(userId, "userId");

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.organization_id', '', true) AS org, set_config('app.user_id', ${userId}, true) AS usr`;
    return fn(tx);
  }, TX_OPTIONS);
}
