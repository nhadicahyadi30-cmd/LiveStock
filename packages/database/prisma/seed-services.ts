// Menambahkan contoh produk Kurban, Aqiqah, dan Layanan ke toko demo (Sumber Rejeki Farm dan Toko Pakan Sejahtera).
// Jalankan: pnpm db:seed:services (setelah pnpm db:seed:demo). Aman diulang (dilewati bila judul sudah ada).
import { PrismaClient, type Prisma } from "@prisma/client";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error("MIGRATION_DATABASE_URL belum diset.");
  process.exit(1);
}
const prisma = new PrismaClient({ datasourceUrl: url });

interface Item { title: string; category: "KURBAN" | "AQIQAH" | "SERVICE"; description: string; price: number; unit: string; stock: number; attributes: Prisma.InputJsonValue }
const BY_EMAIL: Record<string, Item[]> = {
  "budi@demo.test": [
    { title: "Sapi kurban Limousin ± 450 kg (utuh)", category: "KURBAN", description: "Sapi sehat, cukup umur, bersertifikat kesehatan hewan. Bisa dilihat langsung di kandang.", price: 24_500_000, unit: "ekor", stock: 6, attributes: { animal: "SAPI", weightKg: 450, ageMonths: 30, slaughter: false, delivery: true, area: "Bandung dan sekitarnya" } },
    { title: "Patungan sapi kurban (1/7 bagian)", category: "KURBAN", description: "Satu sapi dibagi 7 orang. Nama peserta dicatat di catatan pesanan. Termasuk penyembelihan dan pembagian daging.", price: 3_700_000, unit: "bagian", stock: 21, attributes: { animal: "SAPI", weightKg: 380, ageMonths: 28, shares: 7, slaughter: true, delivery: true, area: "Bandung Raya" } },
    { title: "Kambing kurban Etawa ± 38 kg", category: "KURBAN", description: "Kambing jantan sehat, cukup umur.", price: 3_400_000, unit: "ekor", stock: 25, attributes: { animal: "KAMBING", weightKg: 38, ageMonths: 14, slaughter: false, delivery: true, area: "Bandung dan sekitarnya" } },
    { title: "Paket aqiqah anak laki-laki (2 ekor kambing)", category: "AQIQAH", description: "2 ekor kambing, disembelih sesuai syariat, dimasak atau dikemas mentah sesuai pilihan. Pesan minimal 3 hari sebelumnya.", price: 5_200_000, unit: "paket", stock: 15, attributes: { animal: "KAMBING", weightKg: 30, ageMonths: 12, slaughter: true, delivery: true, area: "Bandung dan sekitarnya" } },
    { title: "Paket aqiqah anak perempuan (1 ekor kambing)", category: "AQIQAH", description: "1 ekor kambing, disembelih dan dikemas, siap diantar.", price: 2_700_000, unit: "paket", stock: 20, attributes: { animal: "KAMBING", weightKg: 30, ageMonths: 12, slaughter: true, delivery: true, area: "Bandung dan sekitarnya" } },
  ],
  "toko@demo.test": [
    { title: "Jasa penyembelihan dan pemotongan hewan kurban", category: "SERVICE", description: "Tim juru sembelih bersertifikat, termasuk pemotongan dan pengemasan daging. Harga per ekor.", price: 450_000, unit: "layanan", stock: 40, attributes: { serviceType: "PEMOTONGAN_PENGEMASAN", area: "Kota Bandung" } },
    { title: "Pengantaran hewan kurban (pickup bak terbuka)", category: "SERVICE", description: "Antar hewan dari kandang ke lokasi Anda, aman dan berpendingin udara terbuka.", price: 250_000, unit: "layanan", stock: 30, attributes: { serviceType: "PENGANTARAN", area: "Bandung Raya" } },
    { title: "Penitipan hewan kurban sampai hari H", category: "SERVICE", description: "Hewan dirawat, diberi pakan, dan dijaga sampai hari penyembelihan.", price: 35_000, unit: "layanan", stock: 50, attributes: { serviceType: "PENITIPAN", area: "Kab. Bandung" } },
  ],
};

try {
  let added = 0;
  for (const [email, items] of Object.entries(BY_EMAIL)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.log(`Lewati ${email}: akun belum ada (jalankan pnpm db:seed:demo).`); continue; }
    const membership = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.user_id', ${user.id}, true), set_config('app.organization_id', '', true)`;
      return tx.membership.findFirst({ where: { userId: user.id, role: "OWNER" } });
    });
    if (!membership) continue;
    const orgId = membership.organizationId;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.organization_id', ${orgId}, true), set_config('app.user_id', ${user.id}, true)`;
      for (const it of items) {
        if (await tx.marketListing.findFirst({ where: { sellerOrgId: orgId, title: it.title } })) continue;
        await tx.marketListing.create({ data: { sellerOrgId: orgId, title: it.title, category: it.category, description: it.description, priceIdr: it.price.toFixed(2), unit: it.unit, stock: it.stock.toFixed(3), status: "PUBLISHED", attributes: it.attributes, createdBy: user.id } });
        added++;
      }
    });
  }
  console.log(`Produk kurban/aqiqah/layanan ditambahkan: ${added}. Jalankan pnpm db:seed:photos untuk foto contoh.`);
} finally {
  await prisma.$disconnect();
}
