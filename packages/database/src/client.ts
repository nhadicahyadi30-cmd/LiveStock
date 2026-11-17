import { PrismaClient } from "@prisma/client";

// Satu instance per proses; di mode dev disimpan di globalThis agar tidak bocor koneksi saat hot reload.
const globalForPrisma = globalThis as unknown as { __slPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__slPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__slPrisma = prisma;
}

// PENTING: query ke tabel bertenant lewat `prisma` langsung (di luar withTenant) mengembalikan nol baris
// karena konteks tenant tidak diset. Itu disengaja (gagal tertutup). Gunakan withTenant().
