// Data dummy lengkap untuk mencoba semua fitur dengan beberapa pengguna peternakan.
// Jalankan: pnpm db:seed:demo   (setelah pnpm db:setup). Semua akun memakai kata sandi demo12345
// (atau SEED_DEMO_PASSWORD). Aman dijalankan sekali; bila data sudah ada, skrip berhenti tanpa mengubah apa pun.
// Untuk mengulang dari nol: pnpm db:push --force-reset, lalu pnpm db:setup dan pnpm db:seed:demo.
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../src/password";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error("MIGRATION_DATABASE_URL belum diset.");
  process.exit(1);
}
const prisma = new PrismaClient({ datasourceUrl: url });
type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------- util
let seedState = 20261122;
const rnd = () => { seedState = (seedState * 1664525 + 1013904223) % 4294967296; return seedState / 4294967296; };
const between = (a: number, b: number) => a + (b - a) * rnd();
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const wib = new Date(Date.now() + 7 * 3_600_000);
const TODAY = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()));
const day = (offset: number) => new Date(TODAY.getTime() + offset * 864e5);
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const ym = (offset: number) => { const x = day(offset * 30); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`; };

async function inOrg<T>(orgId: string, userId: string, fn: (tx: Tx) => Promise<T>, extra?: Record<string, string>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.organization_id', ${orgId}, true), set_config('app.user_id', ${userId}, true)`;
    for (const [k, v] of Object.entries(extra ?? {})) await tx.$queryRaw`SELECT set_config(${k}, ${v}, true)`;
    return fn(tx);
  }, { timeout: 120_000, maxWait: 20_000 });
}

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "demo12345";
/** PNG polos berukuran w x h (RGB), dibuat tanpa pustaka. Hasilnya > 100 byte sesuai batas tabel. */
function makePng(w: number, h: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const t = Buffer.from(type, "ascii"); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { row[1 + x * 3] = rgb[0] + (x % 40); row[2 + x * 3] = rgb[1]; row[3 + x * 3] = rgb[2]; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const PNG_1x1 = makePng(160, 90, [60, 120, 70]);

// ---------------------------------------------------------------- pengguna dan organisasi
interface Person { email: string; name: string }
const PEOPLE = {
  budi: { email: "budi@demo.test", name: "Budi Santoso" },
  siti: { email: "siti@demo.test", name: "Siti Rahayu" },
  joko: { email: "joko@demo.test", name: "Joko Prasetyo" },
  ani: { email: "ani@demo.test", name: "Ani Wijaya" },
  eko: { email: "eko@demo.test", name: "Eko Nugroho" },
  dedi: { email: "dedi@demo.test", name: "Dedi Kurniawan" },
  toko: { email: "toko@demo.test", name: "Hendra (Toko Pakan Sejahtera)" },
  rina: { email: "rina@demo.test", name: "drh. Rina Mahendra" },
  lia: { email: "lia@demo.test", name: "Lia Permata (pengamat)" },
} satisfies Record<string, Person>;
type PersonKey = keyof typeof PEOPLE;

async function main(): Promise<void> {
  const exists = await prisma.user.findUnique({ where: { email: PEOPLE.budi.email } });
  if (exists) {
    const done = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.organization_id', ${"00000000-0000-0000-0000-000000000000"}, true)`;
      return (await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM financing_partners`)[0]!.n;
    }).catch(() => 0n);
    if (done > 0n) console.log("Data dummy sudah ada (budi@demo.test). Tidak ada yang diubah.");
    else console.log("Data dummy ada tetapi tidak lengkap (seed sebelumnya gagal di tengah). Kosongkan database: pnpm db:push --force-reset, lalu pnpm db:setup dan pnpm db:seed:demo.");
    return;
  }
  const speciesRows = await prisma.species.findMany();
  if (speciesRows.length === 0) throw new Error("Tabel species kosong. Jalankan pnpm db:seed dulu.");
  const sp = (code: string) => {
    const s = speciesRows.find((x) => x.code === code);
    if (!s) throw new Error(`Spesies ${code} tidak ada`);
    return s.id;
  };

  const passwordHash = await hashPassword(PASSWORD);
  const uid = {} as Record<PersonKey, string>;
  for (const k of Object.keys(PEOPLE) as PersonKey[]) {
    const u = await prisma.user.create({ data: { ...PEOPLE[k], passwordHash, emailVerifiedAt: new Date() } });
    uid[k] = u.id;
  }

  const mkOrg = async (name: string, slug: string, plan: "FREE" | "STARTER" | "PRO" | "BUSINESS", owner: PersonKey, members: [PersonKey, "MANAGER" | "WORKER" | "VIEWER", boolean?][] = []) => {
    const org = await prisma.$transaction(async (tx) => {
      const id = (await tx.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid()::text AS id`)[0]!.id;
      await tx.$queryRaw`SELECT set_config('app.organization_id', ${id}, true), set_config('app.user_id', ${uid[owner]}, true)`;
      const o = await tx.organization.create({ data: { id, name, slug, plan, planExpiresAt: plan === "FREE" ? null : day(75) } });
      await tx.membership.create({ data: { organizationId: id, userId: uid[owner], role: "OWNER" } });
      for (const [m, role, all] of members) await tx.membership.create({ data: { organizationId: id, userId: uid[m], role, allFarms: all ?? true } });
      return o;
    });
    return org.id;
  };

  const budiOrg = await mkOrg("Sumber Rejeki Farm", "sumber-rejeki-farm", "PRO", "budi", [["siti", "MANAGER"], ["joko", "WORKER", false], ["lia", "VIEWER"]]);
  const aniOrg = await mkOrg("Ayam Makmur Farm", "ayam-makmur-farm", "STARTER", "ani", [["eko", "WORKER"]]);
  const dediOrg = await mkOrg("Tambak Lele Jaya", "tambak-lele-jaya", "FREE", "dedi");
  const tokoOrg = await mkOrg("Toko Pakan Sejahtera", "toko-pakan-sejahtera", "FREE", "toko");
  const vetOrg = await mkOrg("Klinik Hewan drh. Rina", "klinik-drh-rina", "FREE", "rina");

  // ------------------------------------------------------------ rangkaian data peternakan
  interface Farm { id: string }
  const mkFarm = (tx: Tx, org: string, user: string, name: string, code: string, address: string) =>
    tx.farm.create({ data: { organizationId: org, name, code, address, createdBy: user } }) as Promise<Farm>;

  /** Satu batch dengan riwayat bobot, pakan, kematian, dan (opsional) produksi. Jumlah tidak pernah negatif. */
  async function growBatch(tx: Tx, o: { org: string; user: string; farm: string; facility?: string; species: string; code: string; ageDays: number; initial: number; startW: number; endW: number; feedId: string; feedKgPerHeadDay: number; feedPrice: number; deaths: number; sold?: number; eggs?: boolean; milk?: boolean; attrs?: Prisma.InputJsonValue }) {
    const b = await tx.livestockBatch.create({ data: { organizationId: o.org, farmId: o.farm, facilityId: o.facility ?? null, speciesId: o.species, code: o.code, startDate: day(-o.ageDays), initialCount: o.initial, createdBy: o.user, ...(o.attrs ? { attributes: o.attrs } : {}) } });
    let alive = o.initial;
    for (let d = o.ageDays; d >= 0; d -= 7) {
      const f = 1 - d / Math.max(o.ageDays, 1);
      const w = o.startW + (o.endW - o.startW) * f * between(0.97, 1.03);
      await tx.weightRecord.create({ data: { organizationId: o.org, batchId: b.id, measuredOn: day(-d), weightKg: w.toFixed(3), sampleSize: Math.min(20, alive), recordedBy: o.user } });
    }
    for (let d = o.ageDays; d >= 0; d -= 2) {
      const kg = alive * o.feedKgPerHeadDay * 2 * between(0.9, 1.1);
      await tx.feedRecord.create({ data: { organizationId: o.org, batchId: b.id, feedTypeId: o.feedId, givenOn: day(-d), quantityKg: kg.toFixed(3), costTotal: (kg * o.feedPrice).toFixed(2), recordedBy: o.user } });
    }
    for (let i = 0; i < o.deaths; i++) {
      if (alive <= 1) break;
      await tx.mortalityRecord.create({ data: { organizationId: o.org, batchId: b.id, occurredOn: day(-Math.floor(between(1, Math.max(2, o.ageDays)))), count: 1, cause: pick(["DISEASE", "INJURY", "ENVIRONMENT", "UNKNOWN"] as const), recordedBy: o.user } });
      alive -= 1;
    }
    if (o.sold && o.sold < alive) {
      await tx.batchEvent.create({ data: { organizationId: o.org, batchId: b.id, eventType: "SOLD", delta: -o.sold, occurredOn: day(-3), note: "Penjualan sebagian", recordedBy: o.user } });
      alive -= o.sold;
    }
    if (o.eggs) for (let d = 30; d >= 0; d--) await tx.productionRecord.create({ data: { organizationId: o.org, batchId: b.id, kind: "EGG", quantity: Math.round(alive * between(0.78, 0.9)).toString(), unit: "butir", producedOn: day(-d), recordedBy: o.user } });
    if (o.milk) for (let d = 30; d >= 0; d--) await tx.productionRecord.create({ data: { organizationId: o.org, batchId: b.id, kind: "MILK", quantity: (alive * between(9, 13)).toFixed(1), unit: "liter", producedOn: day(-d), recordedBy: o.user } });
    return { id: b.id, alive };
  }

  async function finance(tx: Tx, org: string, user: string, rows: { kind: "INCOME" | "EXPENSE"; category: string; amount: number; on: number; desc: string; batchId?: string }[]) {
    for (const r of rows) await tx.financeEntry.create({ data: { organizationId: org, kind: r.kind, category: r.category, amount: r.amount.toFixed(2), occurredOn: day(r.on), description: r.desc, recordedBy: user, batchId: r.batchId ?? null } });
  }

  async function device(tx: Tx, org: string, user: string, farmId: string, name: string, loc: string, slug: string, metrics: Record<string, [number, number]>, rules: { name: string; metric: string; op: "GT" | "LT"; threshold: number }[], opts: { alarm?: { metric: string; value: number } } = {}) {
    const token = `nt_dev_demo_${slug}`;
    const dev = await tx.device.create({ data: { organizationId: org, farmId, name, locationName: loc, tokenHash: sha(token), tokenPrefix: token.slice(0, 12), lastSeenAt: ago(0.1), createdBy: user } });
    const rows: Prisma.SensorReadingCreateManyInput[] = [];
    for (let h = 48 * 2; h >= 0; h--) for (const [metric, [a, b]] of Object.entries(metrics)) {
      const base = (a + b) / 2, swing = (b - a) / 2;
      let v = base + swing * Math.sin((h / 2 / 24) * 2 * Math.PI) * 0.7 + between(-swing, swing) * 0.2;
      if (opts.alarm && opts.alarm.metric === metric && h <= 6) v = opts.alarm.value + between(-0.1, 0.1);
      rows.push({ organizationId: org, deviceId: dev.id, metric, value: Number(v.toFixed(2)), recordedAt: ago(h / 2) });
    }
    await tx.sensorReading.createMany({ data: rows });
    for (const r of rules) {
      const rule = await tx.alertRule.create({ data: { organizationId: org, deviceId: dev.id, createdBy: user, ...r } });
      const latest = rows.filter((x) => x.metric === r.metric).at(-1)!.value as number;
      const violated = r.op === "GT" ? latest > r.threshold : latest < r.threshold;
      if (violated) await tx.alertEvent.create({ data: { organizationId: org, ruleId: rule.id, deviceId: dev.id, ruleName: r.name, metric: r.metric, op: r.op, threshold: r.threshold, value: latest, triggeredAt: ago(3) } });
      else if (rnd() < 0.5) await tx.alertEvent.create({ data: { organizationId: org, ruleId: rule.id, deviceId: dev.id, ruleName: r.name, metric: r.metric, op: r.op, threshold: r.threshold, value: r.threshold + (r.op === "GT" ? 1 : -1), triggeredAt: ago(30), resolvedAt: ago(27) } });
    }
    await tx.deviceCommand.create({ data: { organizationId: org, deviceId: dev.id, createdBy: user, command: "set_fan", payload: { on: true }, status: "ACKED", sentAt: ago(20), ackedAt: ago(19.9), result: "ok" } });
    await tx.deviceCommand.create({ data: { organizationId: org, deviceId: dev.id, createdBy: user, command: "set_fan", payload: { on: false }, status: "PENDING" } });
    return dev.id;
  }

  const notify = (tx: Tx, org: string, user: string, rows: { kind: string; title: string; body?: string; href?: string; read?: boolean }[]) =>
    tx.notification.createMany({ data: rows.map((r) => ({ organizationId: org, userId: user, kind: r.kind, title: r.title, body: r.body ?? null, href: r.href ?? null, readAt: r.read ? ago(5) : null })) });

  // ============================================================ 1. Sumber Rejeki Farm (Budi): sapi, kambing, domba — paket PRO
  const budiRef = await inOrg(budiOrg, uid.budi, async (tx) => {
    const lembang = await mkFarm(tx, budiOrg, uid.budi, "Kandang Lembang", "LMB", "Lembang, Kab. Bandung Barat");
    const boyolali = await mkFarm(tx, budiOrg, uid.budi, "Kandang Boyolali", "BYL", "Boyolali, Jawa Tengah");
    const mship = await tx.membership.findFirstOrThrow({ where: { userId: uid.joko } });
    await tx.membershipFarm.create({ data: { organizationId: budiOrg, membershipId: mship.id, farmId: lembang.id } });
    const barn1 = await tx.facility.create({ data: { organizationId: budiOrg, farmId: lembang.id, type: "BARN", name: "Kandang A (sapi perah)", capacity: 40 } });
    const barn2 = await tx.facility.create({ data: { organizationId: budiOrg, farmId: lembang.id, type: "PEN", name: "Kandang B (sapi potong)", capacity: 30 } });
    const pen = await tx.facility.create({ data: { organizationId: budiOrg, farmId: boyolali.id, type: "PEN", name: "Kandang Kambing 1", capacity: 80 } });
    const feedHijau = await tx.feedType.create({ data: { organizationId: budiOrg, name: "Hijauan (rumput gajah)", unit: "kg" } });
    const feedKons = await tx.feedType.create({ data: { organizationId: budiOrg, name: "Konsentrat sapi", unit: "kg" } });
    const feedKambing = await tx.feedType.create({ data: { organizationId: budiOrg, name: "Pakan kambing fermentasi", unit: "kg" } });

    // Sapi dilacak per ekor.
    for (let i = 1; i <= 12; i++) {
      const a = await tx.animal.create({ data: { organizationId: budiOrg, farmId: lembang.id, facilityId: i <= 6 ? barn1.id : barn2.id, speciesId: sp("SAPI"), code: `SP-${String(i).padStart(3, "0")}`, name: pick(["Bimo", "Sari", "Mawar", "Kirana", "Jaka", "Lestari", "Gatot", "Dewi"]), sex: i <= 6 ? "FEMALE" : "MALE", birthDate: day(-Math.floor(between(500, 1500))), acquisitionDate: day(-Math.floor(between(100, 400))), attributes: { breed: i <= 6 ? "Friesian Holstein" : "Limousin", purpose: i <= 6 ? "perah" : "potong" }, createdBy: uid.budi } });
      for (let d = 90; d >= 0; d -= 15) await tx.weightRecord.create({ data: { organizationId: budiOrg, animalId: a.id, measuredOn: day(-d), weightKg: (330 + (90 - d) * 0.9 + i * 8 + between(-4, 4)).toFixed(3), recordedBy: uid.siti } });
    }
    const kambing = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((i) => tx.animal.create({ data: { organizationId: budiOrg, farmId: boyolali.id, facilityId: pen.id, speciesId: sp("KAMBING"), code: `KB-${String(i).padStart(3, "0")}`, sex: i % 3 === 0 ? "MALE" : "FEMALE", birthDate: day(-Math.floor(between(200, 700))), attributes: { breed: "Etawa", purpose: "perah" }, createdBy: uid.budi } })));
    void kambing;

    // Kelompok untuk pakan, produksi, kesehatan, dan keuangan.
    const sapiPerah = await growBatch(tx, { org: budiOrg, user: uid.siti, farm: lembang.id, facility: barn1.id, species: sp("SAPI"), code: "SAPI-PERAH-01", ageDays: 120, initial: 20, startW: 380, endW: 430, feedId: feedKons.id, feedKgPerHeadDay: 6, feedPrice: 5800, deaths: 1, milk: true });
    const sapiPotong = await growBatch(tx, { org: budiOrg, user: uid.siti, farm: lembang.id, facility: barn2.id, species: sp("SAPI"), code: "SAPI-FAT-02", ageDays: 150, initial: 14, startW: 290, endW: 420, feedId: feedHijau.id, feedKgPerHeadDay: 12, feedPrice: 650, deaths: 0, sold: 3 });
    const kamb = await growBatch(tx, { org: budiOrg, user: uid.budi, farm: boyolali.id, facility: pen.id, species: sp("KAMBING"), code: "KMB-PENGGEMUKAN-03", ageDays: 100, initial: 60, startW: 14, endW: 27, feedId: feedKambing.id, feedKgPerHeadDay: 1.4, feedPrice: 3200, deaths: 3 });
    void sapiPerah; void sapiPotong;

    // Kesehatan: vaksin terjadwal (hari ini, 2 hari lagi, terlambat), pengobatan, karantina.
    const hr = (kind: "VACCINATION" | "TREATMENT" | "QUARANTINE", status: "PLANNED" | "ACTIVE" | "DONE", title: string, on: number, batchId: string, extra: Partial<Prisma.HealthRecordUncheckedCreateInput> = {}) =>
      tx.healthRecord.create({ data: { organizationId: budiOrg, batchId, kind, status, title, eventOn: day(on), recordedBy: uid.siti, ...(status === "DONE" ? { doneOn: day(on) } : {}), ...extra } });
    await hr("VACCINATION", "PLANNED", "Vaksin PMK ulangan (sapi potong)", 2, sapiPotong.id);
    await hr("VACCINATION", "PLANNED", "Vaksin antraks", -4, sapiPotong.id);
    await hr("VACCINATION", "PLANNED", "Vaksin PMK kambing", 0, kamb.id);
    await hr("VACCINATION", "DONE", "Vaksin PMK dosis pertama", -35, sapiPotong.id, { cost: "1500000.00" });
    await hr("TREATMENT", "ACTIVE", "Pengobatan mastitis", -3, sapiPerah.id, { medicine: "Antibiotik intramamari", affectedCount: 2, withdrawalUntil: day(4), cost: "450000.00", note: "Susu dari sapi terkait tidak dijual sampai masa henti obat selesai" });
    await hr("TREATMENT", "DONE", "Obat cacing", -20, kamb.id, { medicine: "Albendazole", affectedCount: 60, cost: "380000.00" });
    await hr("QUARANTINE", "ACTIVE", "Karantina kambing baru", -5, kamb.id, { affectedCount: 4 });

    // Tugas.
    for (const t of [
      { title: "Bersihkan kandang A", dueOn: 0, assignedTo: uid.joko, status: "OPEN" as const },
      { title: "Timbang sapi potong", dueOn: 3, assignedTo: uid.joko, status: "OPEN" as const },
      { title: "Pesan konsentrat bulan depan", dueOn: -1, assignedTo: uid.siti, status: "OPEN" as const },
      { title: "Cek stok vaksin", dueOn: -6, assignedTo: uid.siti, status: "DONE" as const },
    ]) await tx.task.create({ data: { organizationId: budiOrg, title: t.title, dueOn: day(t.dueOn), assignedTo: t.assignedTo, status: t.status, createdBy: uid.budi, ...(t.status === "DONE" ? { completedAt: ago(100), completedBy: t.assignedTo } : {}) } });

    // Keuangan 3 bulan terakhir, anggaran, dan faktur.
    const fin: Parameters<typeof finance>[3] = [];
    for (let m = 0; m < 3; m++) {
      const off = -m * 30;
      fin.push({ kind: "INCOME", category: "PENJUALAN_HASIL", amount: between(24e6, 31e6), on: off - 5, desc: "Penjualan susu ke koperasi" });
      fin.push({ kind: "EXPENSE", category: "TENAGA_KERJA", amount: 9_500_000, on: off - 2, desc: "Gaji pekerja kandang" });
      fin.push({ kind: "EXPENSE", category: "LISTRIK_AIR", amount: between(1.2e6, 1.8e6), on: off - 8, desc: "Listrik dan air" });
      fin.push({ kind: "EXPENSE", category: "TRANSPORT", amount: between(0.8e6, 1.4e6), on: off - 12, desc: "Transport susu" });
    }
    fin.push({ kind: "INCOME", category: "PENJUALAN_TERNAK", amount: 3 * 21_500_000, on: -3, desc: "Penjualan 3 ekor sapi potong", batchId: sapiPotong.id });
    fin.push({ kind: "EXPENSE", category: "BIBIT", amount: 60 * 850_000, on: -100, desc: "Pembelian 60 kambing bakalan", batchId: kamb.id });
    await finance(tx, budiOrg, uid.siti, fin);
    for (const [cat, amt] of [["PAKAN", 22e6], ["KESEHATAN", 3e6], ["TENAGA_KERJA", 9.5e6], ["LISTRIK_AIR", 2e6]] as const)
      await tx.budget.create({ data: { organizationId: budiOrg, month: ym(0), category: cat, amount: amt.toFixed(2) } });
    await tx.invoice.create({ data: { organizationId: budiOrg, createdBy: uid.siti, number: "INV-2026-001", customerName: "Koperasi Susu Lembang", customerContact: "0812-0000-1111", issueOn: day(-20), dueOn: day(-6), description: "Susu segar 2 minggu", amount: "14500000.00", status: "OPEN" } });
    await tx.invoice.create({ data: { organizationId: budiOrg, createdBy: uid.siti, number: "INV-2026-002", customerName: "RPH Bandung", issueOn: day(-45), dueOn: day(-30), description: "Sapi potong 2 ekor", amount: "43000000.00", status: "PAID", paidOn: day(-28) } });
    await tx.invoice.create({ data: { organizationId: budiOrg, createdBy: uid.siti, number: "INV-2026-003", customerName: "Warung Sate Pak Slamet", issueOn: day(-2), dueOn: day(12), description: "Kambing 5 ekor", amount: "12500000.00", status: "OPEN" } });

    // Harga pasar (untuk prakiraan).
    for (const [commodity, unit, base, slope] of [["SAPI_HIDUP", "kg", 56000, 120], ["KAMBING_HIDUP", "kg", 78000, -60], ["SUSU_SAPI", "liter", 7200, 10], ["PAKAN_JADI", "kg", 6100, 15]] as const)
      for (let w = 12; w >= 0; w--) await tx.marketPrice.create({ data: { organizationId: budiOrg, commodity, unit, price: (base + slope * (12 - w) + between(-250, 250)).toFixed(2), region: "Jawa Barat", source: "Pasar hewan lokal", observedOn: day(-w * 7), recordedBy: uid.siti } });

    // Integrasi.
    const key = "nt_live_demo_budi_open_api_key";
    await tx.apiKey.create({ data: { organizationId: budiOrg, name: "Dashboard koperasi", keyPrefix: key.slice(0, 12), keyHash: sha(key), lastUsedAt: ago(2), createdBy: uid.budi } as Prisma.ApiKeyUncheckedCreateInput });
    const hook = await tx.webhookEndpoint.create({ data: { organizationId: budiOrg, url: "https://example.com/hooks/nusa", secret: "whsec_demo_budi", events: ["alert.triggered", "feed.recorded"], createdBy: uid.budi } as Prisma.WebhookEndpointUncheckedCreateInput });
    await tx.webhookDelivery.create({ data: { organizationId: budiOrg, endpointId: hook.id, event: "feed.recorded", payload: { demo: true }, status: "DELIVERED", attempts: 1, responseStatus: 200, deliveredAt: ago(6) } });
    await tx.webhookDelivery.create({ data: { organizationId: budiOrg, endpointId: hook.id, event: "alert.triggered", payload: { demo: true }, status: "FAILED", attempts: 3, responseStatus: 500, lastError: "HTTP 500", nextAttemptAt: day(1) } });

    // Langganan.
    await tx.subscriptionInvoice.create({ data: { organizationId: budiOrg, createdBy: uid.budi, number: "SUB-2026-0001", plan: "PRO", months: 3, amount: "897000.00", status: "PAID", dueOn: day(-15), paidAt: ago(24 * 15) } });
    await tx.subscriptionInvoice.create({ data: { organizationId: budiOrg, createdBy: uid.budi, number: "SUB-2026-0002", plan: "PRO", months: 1, amount: "299000.00", status: "PENDING", dueOn: day(7) } });

    // IoT: suhu/kelembapan kandang dan kamera.
    const iot = await device(tx, budiOrg, uid.budi, lembang.id, "Sensor Kandang A", "Kandang A", "budi_a", { temperature: [24, 31], humidity: [60, 85] }, [{ name: "Suhu kandang tinggi", metric: "temperature", op: "GT", threshold: 32 }, { name: "Kelembapan rendah", metric: "humidity", op: "LT", threshold: 50 }]);
    void iot;
    const cam = await device(tx, budiOrg, uid.budi, lembang.id, "Kamera Kandang B", "Kandang B", "budi_cam", { temperature: [25, 30] }, []);
    for (let i = 0; i < 4; i++) await tx.cameraSnapshot.create({ data: { organizationId: budiOrg, deviceId: cam, contentType: "image/png", sizeBytes: PNG_1x1.length, data: PNG_1x1, capturedAt: ago(i * 6) } });
    return { sapiPotong: sapiPotong.id, kamb: kamb.id };
  });
  void budiRef;

  // ============================================================ 2. Ayam Makmur Farm (Ani): broiler dan layer — paket STARTER
  await inOrg(aniOrg, uid.ani, async (tx) => {
    const farm = await mkFarm(tx, aniOrg, uid.ani, "Kandang Ayam Cianjur", "CJR", "Cianjur, Jawa Barat");
    const h1 = await tx.facility.create({ data: { organizationId: aniOrg, farmId: farm.id, type: "HOUSE", name: "House 1 (broiler)", capacity: 8000 } });
    const h2 = await tx.facility.create({ data: { organizationId: aniOrg, farmId: farm.id, type: "HOUSE", name: "House 2 (layer)", capacity: 5000 } });
    const starter = await tx.feedType.create({ data: { organizationId: aniOrg, name: "Pakan broiler starter", unit: "kg" } });
    const layer = await tx.feedType.create({ data: { organizationId: aniOrg, name: "Pakan layer", unit: "kg" } });
    const brl = await growBatch(tx, { org: aniOrg, user: uid.ani, farm: farm.id, facility: h1.id, species: sp("AYAM_BROILER"), code: "BRL-2026-11", ageDays: 24, initial: 6000, startW: 0.045, endW: 1.35, feedId: starter.id, feedKgPerHeadDay: 0.085, feedPrice: 8200, deaths: 22 });
    const brlOld = await growBatch(tx, { org: aniOrg, user: uid.ani, farm: farm.id, facility: h1.id, species: sp("AYAM_BROILER"), code: "BRL-2026-09", ageDays: 35, initial: 5500, startW: 0.045, endW: 2.0, feedId: starter.id, feedKgPerHeadDay: 0.1, feedPrice: 8200, deaths: 18 });
    await tx.livestockBatch.update({ where: { id: brlOld.id }, data: { status: "CLOSED", closedAt: ago(24 * 20) } });
    const lyr = await growBatch(tx, { org: aniOrg, user: uid.eko, farm: farm.id, facility: h2.id, species: sp("AYAM_LAYER"), code: "LYR-2026-03", ageDays: 60, initial: 3000, startW: 1.4, endW: 1.75, feedId: layer.id, feedKgPerHeadDay: 0.115, feedPrice: 7600, deaths: 10, eggs: true });
    await tx.healthRecord.create({ data: { organizationId: aniOrg, batchId: brl.id, kind: "VACCINATION", status: "PLANNED", title: "Vaksin ND + IB", eventOn: day(1), recordedBy: uid.ani } });
    await tx.healthRecord.create({ data: { organizationId: aniOrg, batchId: lyr.id, kind: "VACCINATION", status: "PLANNED", title: "Vaksin ND ulangan", eventOn: day(-2), recordedBy: uid.ani } });
    await tx.healthRecord.create({ data: { organizationId: aniOrg, batchId: brl.id, kind: "TREATMENT", status: "DONE", title: "Vitamin dan elektrolit", eventOn: day(-6), doneOn: day(-6), medicine: "Vitamin C", cost: "150000.00", recordedBy: uid.eko } });
    for (const t of [["Ganti sekam House 1", 1, uid.eko], ["Panen broiler BRL-2026-11", 12, uid.ani], ["Kalibrasi sensor amonia", -2, uid.ani]] as const)
      await tx.task.create({ data: { organizationId: aniOrg, title: t[0], dueOn: day(t[1]), assignedTo: t[2], createdBy: uid.ani } });
    const fin: Parameters<typeof finance>[3] = [
      { kind: "EXPENSE", category: "BIBIT", amount: 6000 * 7500, on: -24, desc: "DOC broiler 6000 ekor", batchId: brl.id },
      { kind: "INCOME", category: "PENJUALAN_HASIL", amount: 3000 * 0.84 * 1700 * 7, on: -1, desc: "Penjualan telur 1 minggu", batchId: lyr.id },
      { kind: "INCOME", category: "PENJUALAN_TERNAK", amount: 5400 * 2 * 21000, on: -18, desc: "Panen BRL-2026-09", batchId: brlOld.id },
      { kind: "EXPENSE", category: "TENAGA_KERJA", amount: 6_000_000, on: -3, desc: "Gaji" },
      { kind: "EXPENSE", category: "LISTRIK_AIR", amount: 2_300_000, on: -9, desc: "Listrik blower dan lampu" },
    ];
    await finance(tx, aniOrg, uid.ani, fin);
    for (const [cat, amt] of [["PAKAN", 60e6], ["BIBIT", 45e6]] as const) await tx.budget.create({ data: { organizationId: aniOrg, month: ym(0), category: cat, amount: amt.toFixed(2) } });
    await tx.invoice.create({ data: { organizationId: aniOrg, createdBy: uid.ani, number: "INV-AM-001", customerName: "Pedagang Pasar Cianjur", issueOn: day(-18), dueOn: day(-4), description: "Ayam hidup panen", amount: "113400000.00", status: "OPEN" } });
    for (const [commodity, unit, base, slope] of [["AYAM_HIDUP", "kg", 21000, -90], ["TELUR_AYAM", "kg", 28500, 110], ["JAGUNG_PAKAN", "kg", 5800, 25]] as const)
      for (let w = 12; w >= 0; w--) await tx.marketPrice.create({ data: { organizationId: aniOrg, commodity, unit, price: (base + slope * (12 - w) + between(-200, 200)).toFixed(2), region: "Jawa Barat", source: "Pinsar", observedOn: day(-w * 7), recordedBy: uid.ani } });
    await device(tx, aniOrg, uid.ani, farm.id, "Sensor House 1", "House 1", "ani_h1", { temperature: [27, 33], humidity: [55, 75], ammonia: [8, 16] }, [{ name: "Amonia berbahaya", metric: "ammonia", op: "GT", threshold: 25 }, { name: "Suhu terlalu tinggi", metric: "temperature", op: "GT", threshold: 34 }], { alarm: { metric: "ammonia", value: 28 } });
    await tx.subscriptionInvoice.create({ data: { organizationId: aniOrg, createdBy: uid.ani, number: "SUB-2026-0101", plan: "STARTER", months: 1, amount: "99000.00", status: "PAID", dueOn: day(-20), paidAt: ago(24 * 20) } });
    await notify(tx, aniOrg, uid.ani, [
      { kind: "iot.alert", title: "Alarm: Amonia berbahaya", body: "Sensor House 1 membaca 28 ppm", href: "/app/iot" },
      { kind: "billing.invoice", title: "Faktur langganan lunas", href: "/app/langganan", read: true },
    ]);
  });

  // ============================================================ 3. Tambak Lele Jaya (Dedi): ikan — paket FREE
  await inOrg(dediOrg, uid.dedi, async (tx) => {
    const farm = await mkFarm(tx, dediOrg, uid.dedi, "Kolam Gunungkidul", "GKD", "Gunungkidul, DIY");
    const pond1 = await tx.facility.create({ data: { organizationId: dediOrg, farmId: farm.id, type: "POND", name: "Kolam terpal 1", capacity: 20000 } });
    const pond2 = await tx.facility.create({ data: { organizationId: dediOrg, farmId: farm.id, type: "POND", name: "Kolam beton 2", capacity: 12000 } });
    const pelet = await tx.feedType.create({ data: { organizationId: dediOrg, name: "Pelet apung 781-2", unit: "kg" } });
    const lele = await growBatch(tx, { org: dediOrg, user: uid.dedi, farm: farm.id, facility: pond1.id, species: sp("IKAN"), code: "LELE-2026-A", ageDays: 45, initial: 12000, startW: 0.002, endW: 0.09, feedId: pelet.id, feedKgPerHeadDay: 0.004, feedPrice: 11500, deaths: 40, attrs: { jenis: "lele sangkuriang" } });
    const nila = await growBatch(tx, { org: dediOrg, user: uid.dedi, farm: farm.id, facility: pond2.id, species: sp("IKAN"), code: "NILA-2026-B", ageDays: 70, initial: 6000, startW: 0.003, endW: 0.2, feedId: pelet.id, feedKgPerHeadDay: 0.006, feedPrice: 11500, deaths: 25, attrs: { jenis: "nila" } });
    await tx.productionRecord.create({ data: { organizationId: dediOrg, batchId: nila.id, kind: "HARVEST", quantity: "180.000", unit: "kg", producedOn: day(-4), note: "Panen parsial", recordedBy: uid.dedi } });
    await tx.healthRecord.create({ data: { organizationId: dediOrg, batchId: lele.id, kind: "TREATMENT", status: "ACTIVE", title: "Perlakuan garam untuk jamur", eventOn: day(-1), medicine: "Garam kasar", recordedBy: uid.dedi } });
    await tx.healthRecord.create({ data: { organizationId: dediOrg, batchId: nila.id, kind: "VACCINATION", status: "PLANNED", title: "Vaksin Streptococcus", eventOn: day(3), recordedBy: uid.dedi } });
    await tx.task.create({ data: { organizationId: dediOrg, title: "Ganti air kolam 1 (30%)", dueOn: day(0), assignedTo: uid.dedi, createdBy: uid.dedi } });
    await tx.task.create({ data: { organizationId: dediOrg, title: "Sampling bobot lele", dueOn: day(2), assignedTo: uid.dedi, createdBy: uid.dedi } });
    await finance(tx, dediOrg, uid.dedi, [
      { kind: "EXPENSE", category: "BIBIT", amount: 12000 * 350, on: -45, desc: "Benih lele 12.000 ekor", batchId: lele.id },
      { kind: "INCOME", category: "PENJUALAN_HASIL", amount: 180 * 28000, on: -4, desc: "Panen nila 180 kg", batchId: nila.id },
      { kind: "EXPENSE", category: "LISTRIK_AIR", amount: 750_000, on: -10, desc: "Listrik aerator" },
    ]);
    for (const [commodity, unit, base, slope] of [["IKAN_LELE", "kg", 22000, 80], ["IKAN_NILA", "kg", 27000, 40]] as const)
      for (let w = 10; w >= 0; w--) await tx.marketPrice.create({ data: { organizationId: dediOrg, commodity, unit, price: (base + slope * (10 - w) + between(-300, 300)).toFixed(2), region: "DIY", source: "Pasar ikan", observedOn: day(-w * 7), recordedBy: uid.dedi } });
    await device(tx, dediOrg, uid.dedi, farm.id, "Sensor kolam 1", "Kolam terpal 1", "dedi_k1", { ph: [6.8, 7.8], do: [4.5, 7], temperature: [26, 31], ammonia: [0.05, 0.3] }, [{ name: "Oksigen terlarut rendah", metric: "do", op: "LT", threshold: 4 }, { name: "pH terlalu asam", metric: "ph", op: "LT", threshold: 6.5 }], { alarm: { metric: "do", value: 3.2 } });
    await notify(tx, dediOrg, uid.dedi, [{ kind: "iot.alert", title: "Alarm: Oksigen terlarut rendah", body: "Kolam terpal 1 membaca 3,2 mg/L", href: "/app/iot" }]);
  });

  // ============================================================ 4. Toko Pakan Sejahtera (penjual) dan 5. Klinik drh. Rina (dokter hewan)
  const listings: Record<string, string> = {};
  await inOrg(tokoOrg, uid.toko, async (tx) => {
    await tx.vendorProfile.create({ data: { orgId: tokoOrg, displayName: "Toko Pakan Sejahtera", city: "Bandung", phone: "0812-3456-7890", about: "Pakan, obat, dan peralatan kandang. Pengiriman se-Jawa Barat." } });
    for (const [key, title, category, price, unit, stock, status] of [
      ["konsentrat", "Konsentrat sapi 50 kg", "FEED", 285000, "karung", 120, "PUBLISHED"],
      ["pelet", "Pelet apung ikan 781-2", "FEED", 395000, "karung", 60, "PUBLISHED"],
      ["vitamin", "Vitamin ternak multivitamin", "MEDICINE", 65000, "botol", 200, "PUBLISHED"],
      ["feeder", "Tempat pakan ayam otomatis", "EQUIPMENT", 45000, "buah", 80, "PUBLISHED"],
      ["draft", "Terpal kolam 4x6 m", "EQUIPMENT", 410000, "lembar", 15, "DRAFT"],
    ] as const) { const l = await tx.marketListing.create({ data: { createdBy: uid.toko, sellerOrgId: tokoOrg, title, category, description: `${title} - kualitas terjamin.`, priceIdr: price.toFixed(2), unit, stock: stock.toFixed(3), status } }); listings[key] = l.id; }
  });
  const sellFarm: Record<string, string> = {};
  await inOrg(budiOrg, uid.budi, async (tx) => {
    await tx.vendorProfile.create({ data: { orgId: budiOrg, displayName: "Sumber Rejeki Farm", city: "Lembang", phone: "0813-1111-2222", about: "Sapi potong dan kambing siap jual, dikirim langsung dari kandang." } });
    for (const [key, title, category, price, unit, stock] of [["kambing", "Kambing Etawa jantan siap kurban", "LIVESTOCK", 3_200_000, "ekor", 20], ["sapi", "Sapi Limousin 400 kg", "LIVESTOCK", 22_500_000, "ekor", 5]] as const) {
      const l = await tx.marketListing.create({ data: { createdBy: uid.budi, sellerOrgId: budiOrg, title, category, description: title, priceIdr: price.toFixed(2), unit, stock: stock.toFixed(3), status: "PUBLISHED" } }); sellFarm[key] = l.id;
    }
  });

  // Pesanan: Ani dan Dedi membeli dari toko; Ani membeli kambing dari Budi. Berbagai status.
  type OrderStatus = "PENDING" | "ACCEPTED" | "SHIPPED" | "COMPLETED" | "REJECTED" | "CANCELLED";
  async function order(buyer: string, buyerUser: string, seller: string, sellerUser: string, listingId: string, title: string, unit: string, qty: number, price: number, status: OrderStatus, flow: { shipment?: "DIKEMAS" | "DALAM_PERJALANAN" | "TIBA_DI_TUJUAN"; payment?: "AWAITING" | "PROOF_SUBMITTED" | "HELD" | "RELEASED" | "DISPUTED"; review?: number } = {}) {
    const total = (qty * price).toFixed(2);
    const o = await inOrg(buyer, buyerUser, (tx) => tx.marketOrder.create({ data: { createdBy: buyerUser, listingId, buyerOrgId: buyer, sellerOrgId: seller, listingTitle: title, unit, quantity: qty.toFixed(3), unitPrice: price.toFixed(2), total, status, buyerNote: "Mohon dikirim pagi hari" } }));
    if (flow.payment) {
      await inOrg(buyer, buyerUser, (tx) => tx.marketPayment.create({ data: { orderId: o.id, buyerOrgId: buyer, sellerOrgId: seller, amount: total, method: "TRANSFER", reference: "TRF-DEMO-" + o.id.slice(-4), status: flow.payment!, ...(flow.payment !== "AWAITING" ? { submittedAt: ago(48) } : {}), ...(["HELD", "RELEASED"].includes(flow.payment!) ? { heldAt: ago(40) } : {}), ...(flow.payment === "RELEASED" ? { releasedAt: ago(10) } : {}), ...(flow.payment === "DISPUTED" ? { disputeReason: "Barang belum sesuai pesanan" } : {}) } }));
    }
    if (flow.shipment) {
      const sh = await inOrg(seller, sellerUser, (tx) => tx.marketShipment.create({ data: { orderId: o.id, sellerOrgId: seller, buyerOrgId: buyer, method: "KURIR", courier: "J&T Cargo", trackingNumber: "JT" + o.id.slice(-8).toUpperCase(), fee: "35000.00", etaOn: day(2) } }));
      const steps = (["DIKEMAS", "DALAM_PERJALANAN", "TIBA_DI_TUJUAN"] as const).slice(0, (["DIKEMAS", "DALAM_PERJALANAN", "TIBA_DI_TUJUAN"] as const).indexOf(flow.shipment) + 1);
      for (const [i, s] of steps.entries()) await inOrg(seller, sellerUser, (tx) => tx.marketShipmentEvent.create({ data: { createdBy: sellerUser, shipmentId: sh.id, sellerOrgId: seller, buyerOrgId: buyer, status: s, location: ["Gudang penjual", "Hub Bandung", "Alamat pembeli"][i]! } }));
    }
    if (flow.review) await inOrg(buyer, buyerUser, (tx) => tx.marketReview.create({ data: { orderId: o.id, sellerOrgId: seller, buyerOrgId: buyer, rating: flow.review!, comment: flow.review! >= 4 ? "Barang sesuai dan pengiriman cepat." : "Pengiriman agak lambat." } }));
  }
  await order(aniOrg, uid.ani, tokoOrg, uid.toko, listings.feeder!, "Tempat pakan ayam otomatis", "buah", 40, 45000, "COMPLETED", { shipment: "TIBA_DI_TUJUAN", payment: "RELEASED", review: 5 });
  await order(aniOrg, uid.ani, tokoOrg, uid.toko, listings.vitamin!, "Vitamin ternak multivitamin", "botol", 24, 65000, "SHIPPED", { shipment: "DALAM_PERJALANAN", payment: "HELD" });
  await order(dediOrg, uid.dedi, tokoOrg, uid.toko, listings.pelet!, "Pelet apung ikan 781-2", "karung", 10, 395000, "ACCEPTED", { payment: "PROOF_SUBMITTED" });
  await order(dediOrg, uid.dedi, tokoOrg, uid.toko, listings.vitamin!, "Vitamin ternak multivitamin", "botol", 6, 65000, "PENDING");
  await order(budiOrg, uid.budi, tokoOrg, uid.toko, listings.konsentrat!, "Konsentrat sapi 50 kg", "karung", 30, 285000, "COMPLETED", { shipment: "TIBA_DI_TUJUAN", payment: "RELEASED", review: 4 });
  await order(budiOrg, uid.budi, tokoOrg, uid.toko, listings.feeder!, "Tempat pakan ayam otomatis", "buah", 5, 45000, "REJECTED");
  await order(aniOrg, uid.ani, budiOrg, uid.budi, sellFarm.kambing!, "Kambing Etawa jantan siap kurban", "ekor", 4, 3_200_000, "ACCEPTED", { payment: "AWAITING" });
  await order(dediOrg, uid.dedi, budiOrg, uid.budi, sellFarm.kambing!, "Kambing Etawa jantan siap kurban", "ekor", 1, 3_200_000, "SHIPPED", { shipment: "DIKEMAS", payment: "DISPUTED" });
  await inOrg(aniOrg, uid.ani, (tx) => tx.marketOrder.create({ data: { createdBy: uid.ani, listingId: listings.draft!, buyerOrgId: aniOrg, sellerOrgId: tokoOrg, listingTitle: "Terpal kolam 4x6 m", unit: "lembar", quantity: "2.000", unitPrice: "410000.00", total: "820000.00", status: "CANCELLED" } }));

  // Dokter hewan.
  await inOrg(vetOrg, uid.rina, (tx) => tx.vetProfile.create({ data: { orgId: vetOrg, displayName: "drh. Rina Mahendra", city: "Bandung", specialty: "Ruminansia dan unggas", licenseNo: "DEMO-STRV-0001", about: "Pengalaman 9 tahun menangani sapi perah dan ayam. Konsultasi lewat chat.", accepting: true } }));
  async function consult(farmOrg: string, farmUser: string, farmName: string, subject: string, species: string, symptoms: string, status: "OPEN" | "CLOSED", chat: [boolean, string][]) {
    const c = await inOrg(farmOrg, farmUser, (tx) => tx.vetConsultation.create({ data: { createdBy: farmUser, farmOrgId: farmOrg, vetOrgId: vetOrg, farmName, subject, species, symptoms, status } }));
    for (const [fromFarm, body] of chat) {
      const [org, user] = fromFarm ? [farmOrg, farmUser] : [vetOrg, uid.rina];
      await inOrg(org, user, (tx) => tx.vetMessage.create({ data: { consultationId: c.id, farmOrgId: farmOrg, vetOrgId: vetOrg, authorOrgId: org, authorUserId: user, body } }));
    }
  }
  await consult(aniOrg, uid.ani, "Ayam Makmur Farm", "Ayam broiler lesu dan bersin", "Ayam broiler", "Umur 24 hari, nafsu makan turun, bersin dan ngorok, kotoran kehijauan. Kematian naik 5 ekor sehari.", "OPEN", [
    [true, "Dok, mohon bantu. Gejala mulai kemarin sore."],
    [false, "Terima kasih infonya. Berapa suhu kandang dan apakah ada ayam yang lehernya terpuntir? Tolong cek ventilasi dan kirim foto bila bisa."],
    [true, "Suhu 33 derajat siang hari, amonia agak tinggi. Tidak ada yang terpuntir."],
  ]);
  await consult(budiOrg, uid.siti, "Sumber Rejeki Farm", "Sapi perah, susu menggumpal", "Sapi", "Dua sapi perah, ambing bengkak, susu menggumpal sejak 3 hari.", "CLOSED", [
    [true, "Mohon arahan untuk dua sapi dengan ambing bengkak."],
    [false, "Gejalanya mengarah ke mastitis. Pisahkan susu sapi tersebut dan lakukan pemeriksaan langsung oleh dokter hewan; obat dan dosis sesuai resep setelah pemeriksaan."],
    [true, "Baik dok, sudah ditangani dan membaik."],
  ]);

  // Mitra pembiayaan (operator) dan pengajuan.
  const partners = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.operator', 'on', true)`;
    const list = [] as { id: string }[];
    for (const p of [
      { name: "Bank Tani Nusantara (contoh)", kind: "BANK", description: "Kredit usaha ternak untuk peternak dengan usaha berjalan minimal 6 bulan.", minAmount: "20000000.00", maxAmount: "500000000.00", rateInfo: "Mulai 9% per tahun (contoh)", contactUrl: "https://example.com/bank-tani" },
      { name: "Koperasi Peternak Maju (contoh)", kind: "KOPERASI", description: "Pinjaman modal kerja anggota koperasi, tenor pendek.", minAmount: "5000000.00", maxAmount: "75000000.00", rateInfo: "1% per bulan (contoh)", contactPhone: "0811-2222-3333" },
      { name: "TaniFin (contoh)", kind: "FINTECH", description: "Pembiayaan pakan dan bibit dengan pencairan cepat.", minAmount: "2000000.00", maxAmount: "50000000.00", rateInfo: "Sesuai penilaian (contoh)", contactUrl: "https://example.com/tanifin" },
    ] as const) list.push(await tx.financingPartner.create({ data: p }));
    return list;
  });
  await inOrg(budiOrg, uid.budi, async (tx) => {
    await tx.financingApplication.create({ data: { organizationId: budiOrg, partnerId: partners[0]!.id, amount: "150000000.00", tenorMonths: 24, purpose: "KANDANG", note: "Perluasan kandang sapi perah", snapshot: { skor: "contoh", pendapatan3Bulan: 95_000_000, usahaBerjalanBulan: 18 }, status: "SUBMITTED", createdBy: uid.budi } as Prisma.FinancingApplicationUncheckedCreateInput });
  });
  await inOrg(aniOrg, uid.ani, async (tx) => {
    await tx.financingApplication.create({ data: { organizationId: aniOrg, partnerId: partners[2]!.id, amount: "30000000.00", tenorMonths: 6, purpose: "PAKAN", snapshot: { skor: "contoh" }, status: "APPROVED", partnerNote: "Disetujui (contoh data demo)", createdBy: uid.ani } as Prisma.FinancingApplicationUncheckedCreateInput });
  });

  // Notifikasi lintas fitur untuk beberapa pengguna.
  await inOrg(budiOrg, uid.budi, (tx) => notify(tx, budiOrg, uid.budi, [
    { kind: "market.order", title: "Pesanan baru: Kambing Etawa x4", body: "Dari Ayam Makmur Farm", href: "/app/pasar" },
    { kind: "market.payment", title: "Pembeli membuka sengketa pembayaran", href: "/app/pasar" },
    { kind: "billing.invoice", title: "Faktur langganan jatuh tempo 7 hari lagi", href: "/app/langganan", read: true },
  ]));
  await inOrg(tokoOrg, uid.toko, (tx) => notify(tx, tokoOrg, uid.toko, [
    { kind: "market.order", title: "Pesanan baru: Vitamin ternak x6", href: "/app/pasar" },
    { kind: "market.payment", title: "Bukti pembayaran dikirim pembeli", href: "/app/pasar" },
  ]));
  await inOrg(vetOrg, uid.rina, (tx) => notify(tx, vetOrg, uid.rina, [{ kind: "vet.message", title: "Pesan baru dari Ayam Makmur Farm", href: "/app/dokter" }]));

  console.log("\nSeed data dummy selesai. Semua akun memakai kata sandi: " + PASSWORD + "\n");
  for (const [k, p] of Object.entries(PEOPLE)) console.log(`  ${p.email.padEnd(18)} ${p.name}${k === "budi" ? "  [OWNER Sumber Rejeki Farm, paket PRO]" : k === "siti" ? "  [MANAGER]" : k === "joko" ? "  [WORKER, hanya Kandang Lembang]" : k === "lia" ? "  [VIEWER]" : k === "ani" ? "  [OWNER Ayam Makmur Farm, STARTER, IoT+alarm]" : k === "eko" ? "  [WORKER]" : k === "dedi" ? "  [OWNER Tambak Lele Jaya, FREE, IoT+alarm]" : k === "toko" ? "  [penjual marketplace]" : "  [dokter hewan]"}`);
  console.log("\nToken perangkat IoT untuk uji kirim data: nt_dev_demo_budi_a, nt_dev_demo_budi_cam, nt_dev_demo_ani_h1, nt_dev_demo_dedi_k1");
  console.log("Kunci API terbuka (Sumber Rejeki Farm): nt_live_demo_budi_open_api_key");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
