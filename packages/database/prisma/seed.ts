// Seed referensi global (species). Dijalankan sebagai migrator karena app_user hanya boleh membaca species.
// Aman dijalankan berulang (upsert berdasarkan code).
import { PrismaClient, TrackingMode } from "@prisma/client";
import { hashPassword } from "../src/password";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error("MIGRATION_DATABASE_URL belum diset.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url });

interface SpeciesSeed {
  code: string;
  name: string;
  trackingMode: TrackingMode;
  metrics: string[];
}

// Metrik mengikuti bagian "Species Configuration" di blueprint. Perlu disesuaikan dengan hasil pilot.
const SPECIES: SpeciesSeed[] = [
  { code: "SAPI", name: "Sapi", trackingMode: "INDIVIDUAL", metrics: ["weight_kg", "adg", "pregnancy", "birth", "milk_l", "meat_kg"] },
  { code: "KAMBING", name: "Kambing", trackingMode: "INDIVIDUAL", metrics: ["weight_kg", "adg", "pregnancy", "birth", "purpose"] },
  { code: "DOMBA", name: "Domba", trackingMode: "INDIVIDUAL", metrics: ["weight_kg", "adg", "pregnancy", "birth", "purpose"] },
  { code: "AYAM_BROILER", name: "Ayam broiler", trackingMode: "GROUP", metrics: ["age_days", "weight_kg", "fcr", "mortality", "feed_kg"] },
  { code: "AYAM_LAYER", name: "Ayam layer", trackingMode: "GROUP", metrics: ["egg_count", "hen_day_pct", "egg_quality", "fcr", "mortality"] },
  { code: "BEBEK", name: "Bebek", trackingMode: "GROUP", metrics: ["egg_count", "duck_day_pct", "egg_quality", "fcr", "mortality"] },
  { code: "BABI", name: "Babi", trackingMode: "BOTH", metrics: ["weight_kg", "adg", "litter", "fcr"] },
  { code: "KELINCI", name: "Kelinci", trackingMode: "BOTH", metrics: ["weight_kg", "adg", "litter", "fcr"] },
  { code: "IKAN", name: "Ikan", trackingMode: "GROUP", metrics: ["density", "biomass_kg", "ph", "do", "temperature", "ammonia", "harvest_kg"] },
  { code: "UDANG", name: "Udang", trackingMode: "GROUP", metrics: ["density", "biomass_kg", "ph", "do", "temperature", "salinity", "ammonia", "harvest_kg"] },
];

// Data demo untuk mencoba API secara manual. Hanya dibuat bila SEED_DEMO=true.
const DEMO = {
  userId: "0192f0a0-0000-7000-8000-00000000d001",
  organizationId: "0192f0a0-0000-7000-8000-00000000d002",
  farmId: "0192f0a0-0000-7000-8000-00000000d003",
};

async function seedDemo(): Promise<void> {
  // Kata sandi demo hanya untuk pengembangan lokal. Ganti lewat SEED_DEMO_PASSWORD.
  // Diatur ulang setiap seed demo dijalankan, supaya akun demo lama tanpa kata sandi ikut diperbaiki.
  const passwordHash = await hashPassword(process.env.SEED_DEMO_PASSWORD ?? "demo12345");
  await prisma.user.upsert({
    where: { id: DEMO.userId },
    update: { passwordHash, isActive: true },
    create: { id: DEMO.userId, email: "demo@example.test", name: "Pengguna Demo", passwordHash },
  });

  // migrator juga tunduk pada RLS (FORCE), jadi konteks tenant diset seperti di aplikasi.
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.organization_id', ${DEMO.organizationId}, true) AS org, set_config('app.user_id', ${DEMO.userId}, true) AS usr`;

    await tx.organization.upsert({
      where: { id: DEMO.organizationId },
      update: {},
      create: { id: DEMO.organizationId, name: "Peternakan Demo", slug: "peternakan-demo" },
    });
    await tx.membership.upsert({
      where: { organizationId_userId: { organizationId: DEMO.organizationId, userId: DEMO.userId } },
      update: {},
      create: { organizationId: DEMO.organizationId, userId: DEMO.userId, role: "OWNER" },
    });
    await tx.farm.upsert({
      where: { id: DEMO.farmId },
      update: {},
      create: { id: DEMO.farmId, organizationId: DEMO.organizationId, name: "Farm Demo", code: "DEMO" },
    });
  });

  console.log("Seed demo selesai. Pakai header berikut untuk mencoba API:");
  console.log(`  x-dev-user-id: ${DEMO.userId}`);
  console.log(`  x-dev-organization-id: ${DEMO.organizationId}`);
}

try {
  for (const s of SPECIES) {
    await prisma.species.upsert({
      where: { code: s.code },
      update: { name: s.name, trackingMode: s.trackingMode, metricsConfig: { metrics: s.metrics } },
      create: { code: s.code, name: s.name, trackingMode: s.trackingMode, metricsConfig: { metrics: s.metrics } },
    });
  }
  console.log(`Seed species selesai (${SPECIES.length} baris).`);

  if (process.env.SEED_DEMO === "true") {
    await seedDemo();
  }
} finally {
  await prisma.$disconnect();
}
