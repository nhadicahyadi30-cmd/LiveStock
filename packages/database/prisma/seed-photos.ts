// Menambahkan foto contoh (gambar berwarna polos) ke produk marketplace yang belum punya foto.
// Jalankan: pnpm db:seed:photos. Aman diulang. Foto asli bisa diunggah lewat halaman Pasar > Toko saya > Foto.
import { PrismaClient } from "@prisma/client";
import { makePng } from "./demo-image";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error("MIGRATION_DATABASE_URL belum diset.");
  process.exit(1);
}
const prisma = new PrismaClient({ datasourceUrl: url });
const COLORS: Record<string, [number, number, number][]> = {
  LIVESTOCK: [[120, 80, 50], [150, 110, 70]],
  FEED: [[190, 150, 60], [160, 120, 40]],
  MEDICINE: [[60, 130, 170], [90, 160, 190]],
  EQUIPMENT: [[110, 110, 120], [140, 140, 150]],
  PRODUCE: [[200, 170, 90], [220, 190, 120]],
  KURBAN: [[100, 70, 45], [130, 95, 60]],
  AQIQAH: [[90, 120, 80], [120, 150, 100]],
  SERVICE: [[70, 100, 140], [100, 130, 170]],
};

try {
  const sellers = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.operator', 'on', true)`;
    return tx.$queryRaw<{ org_id: string }[]>`SELECT org_id FROM vendor_profiles`;
  });
  let added = 0;
  for (const s of sellers) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.organization_id', ${s.org_id}, true)`;
      const listings = await tx.marketListing.findMany({ where: { sellerOrgId: s.org_id } });
      for (const l of listings) {
        if ((await tx.marketListingImage.count({ where: { listingId: l.id } })) > 0) continue;
        const palette = COLORS[l.category] ?? COLORS.EQUIPMENT!;
        for (const [i, rgb] of palette.entries()) {
          const data = makePng(400, 300, rgb);
          await tx.marketListingImage.create({ data: { listingId: l.id, sellerOrgId: s.org_id, contentType: "image/png", sizeBytes: data.length, position: i, data } });
          added++;
        }
      }
    });
  }
  console.log(`Foto contoh ditambahkan: ${added}.`);
} finally {
  await prisma.$disconnect();
}
