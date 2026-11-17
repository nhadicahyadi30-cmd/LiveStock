// Uji isolasi tenant terhadap PostgreSQL sungguhan (butuh DATABASE_URL sebagai app_user, skema, dan pnpm db:rls).
// Gunakan database uji terpisah: uji ini menulis data dan tidak membersihkannya.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withTenant, withUser } from "../src";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("tenant isolation", () => {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const farmA = randomUUID();
  const farmB = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const ctxA = { organizationId: orgA, userId: userA };
  const ctxB = { organizationId: orgB, userId: userB };

  beforeAll(async () => {
    // users tidak bertenant (lihat TODO di 001_rls.sql).
    await prisma.user.createMany({
      data: [
        { id: userA, email: `a-${suffix}@example.test` },
        { id: userB, email: `b-${suffix}@example.test` },
      ],
    });

    await withTenant(ctxA, async (tx) => {
      await tx.organization.create({ data: { id: orgA, name: "Org A", slug: `org-a-${suffix}` } });
      await tx.membership.create({ data: { organizationId: orgA, userId: userA, role: "OWNER" } });
      await tx.farm.create({ data: { id: farmA, organizationId: orgA, name: "Farm A", code: "A1" } });
    });

    await withTenant(ctxB, async (tx) => {
      await tx.organization.create({ data: { id: orgB, name: "Org B", slug: `org-b-${suffix}` } });
      await tx.membership.create({ data: { organizationId: orgB, userId: userB, role: "OWNER" } });
      await tx.farm.create({ data: { id: farmB, organizationId: orgB, name: "Farm B", code: "B1" } });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("tenant A hanya melihat farm miliknya", async () => {
    const farms = await withTenant(ctxA, (tx) => tx.farm.findMany());
    expect(farms.map((f) => f.id)).toEqual([farmA]);
  });

  it("tenant A tidak bisa membaca farm tenant B lewat id", async () => {
    const farm = await withTenant(ctxA, (tx) => tx.farm.findUnique({ where: { id: farmB } }));
    expect(farm).toBeNull();
  });

  it("tanpa konteks tenant, query tidak mengembalikan baris (gagal tertutup)", async () => {
    const farms = await prisma.farm.findMany();
    expect(farms).toHaveLength(0);
  });

  it("konteks tenant tidak bocor setelah transaksi selesai", async () => {
    await withTenant(ctxA, (tx) => tx.farm.findMany());
    const farms = await prisma.farm.findMany();
    expect(farms).toHaveLength(0);
  });

  it("tenant A tidak bisa menulis baris untuk organisasi B", async () => {
    await expect(
      withTenant(ctxA, (tx) =>
        tx.farm.create({ data: { organizationId: orgB, name: "Salah", code: `X-${suffix}` } }),
      ),
    ).rejects.toThrow();
  });

  it("tenant A tidak bisa mengubah atau menghapus farm tenant B", async () => {
    const updated = await withTenant(ctxA, (tx) =>
      tx.farm.updateMany({ where: { id: farmB }, data: { name: "Diubah A" } }),
    );
    const deleted = await withTenant(ctxA, (tx) => tx.farm.deleteMany({ where: { id: farmB } }));
    expect(updated.count).toBe(0);
    expect(deleted.count).toBe(0);

    const stillThere = await withTenant(ctxB, (tx) => tx.farm.findUnique({ where: { id: farmB } }));
    expect(stillThere?.name).toBe("Farm B");
  });

  it("pengguna bisa memuat keanggotaannya sendiri tanpa organisasi aktif", async () => {
    const memberships = await withUser(userA, (tx) => tx.membership.findMany());
    expect(memberships.map((m) => m.organizationId)).toEqual([orgA]);
  });

  it("audit_logs hanya bisa ditambah, tidak diubah atau dihapus", async () => {
    await withTenant(ctxA, (tx) =>
      tx.auditLog.create({
        data: { organizationId: orgA, actorId: userA, action: "TEST", entityType: "farm", entityId: farmA },
      }),
    );
    await expect(withTenant(ctxA, (tx) => tx.auditLog.deleteMany({}))).rejects.toThrow();
    await expect(
      withTenant(ctxA, (tx) => tx.auditLog.updateMany({ data: { action: "UBAH" } })),
    ).rejects.toThrow();
  });

  it("species hanya bisa dibaca oleh app_user", async () => {
    await expect(
      prisma.species.create({ data: { code: `TEST-${suffix}`, name: "Uji", trackingMode: "GROUP" } }),
    ).rejects.toThrow();
  });

  it("mortalitas tidak boleh melebihi populasi batch", async () => {
    const species = await prisma.species.findFirst();
    if (!species) throw new Error("Jalankan pnpm db:seed terlebih dahulu.");

    const batchId = randomUUID();
    await withTenant(ctxA, (tx) =>
      tx.livestockBatch.create({
        data: {
          id: batchId,
          organizationId: orgA,
          farmId: farmA,
          speciesId: species.id,
          code: `BR-${suffix}`,
          startDate: new Date("2026-11-01"),
          initialCount: 10,
        },
      }),
    );

    await expect(
      withTenant(ctxA, (tx) =>
        tx.mortalityRecord.create({
          data: {
            organizationId: orgA,
            batchId,
            occurredOn: new Date("2026-11-05"),
            count: 11,
            recordedBy: userA,
          },
        }),
      ),
    ).rejects.toThrow();

    const ok = await withTenant(ctxA, async (tx) => {
      await tx.mortalityRecord.create({
        data: {
          organizationId: orgA,
          batchId,
          occurredOn: new Date("2026-11-05"),
          count: 3,
          recordedBy: userA,
        },
      });
      return tx.$queryRaw<{ current_count: bigint }[]>`
        SELECT current_count FROM batch_population WHERE batch_id = ${batchId}::uuid`;
    });
    expect(Number(ok[0]?.current_count)).toBe(7);
  });

  it("catatan harus menunjuk tepat satu ternak atau batch", async () => {
    await expect(
      withTenant(ctxA, (tx) =>
        tx.weightRecord.create({
          data: {
            organizationId: orgA,
            measuredOn: new Date("2026-11-05"),
            weightKg: "100.000",
            recordedBy: userA,
          },
        }),
      ),
    ).rejects.toThrow();
  });
});
