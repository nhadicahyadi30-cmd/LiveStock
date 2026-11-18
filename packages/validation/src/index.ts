// Skema validasi request (Zod) yang dipakai API. Aturan mengikuti dokumen spesifikasi bagian 4.
// organization_id sengaja TIDAK ada di skema input mana pun: organisasi selalu berasal dari sesi.
import { z } from "zod";

export const uuid = z.string().uuid();

/** Kode ternak, batch, atau farm: 1-32 karakter huruf, angka, titik, garis bawah, atau strip. */
export const code = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/, "Hanya huruf, angka, titik, garis bawah, dan strip");

/** Tanggal kejadian tidak boleh di masa depan (toleransi satu hari untuk perbedaan zona waktu). */
const pastOrToday = z.coerce.date().refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
  message: "Tanggal tidak boleh di masa depan",
});

/** Id yang dibuat di perangkat untuk sinkronisasi offline yang idempoten. */
const clientId = uuid.optional();

export const farmCreate = z.object({
  name: z.string().trim().min(1).max(120),
  code,
  address: z.string().trim().max(300).optional(),
  timezone: z.string().trim().max(64).optional(),
});
export type FarmCreate = z.infer<typeof farmCreate>;

export const animalCreate = z.object({
  farmId: uuid,
  facilityId: uuid.optional(),
  speciesId: uuid,
  code,
  name: z.string().trim().max(120).optional(),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
  birthDate: z.coerce.date().optional(),
  acquisitionDate: z.coerce.date().optional(),
  clientId,
});
export type AnimalCreate = z.infer<typeof animalCreate>;

export const batchCreate = z.object({
  farmId: uuid,
  facilityId: uuid.optional(),
  speciesId: uuid,
  code,
  startDate: z.coerce.date(),
  initialCount: z.number().int().positive().max(10_000_000),
  clientId,
});
export type BatchCreate = z.infer<typeof batchCreate>;

/** Tepat satu dari animalId atau batchId harus diisi. */
const exactlyOneTarget = <T extends { animalId?: string | undefined; batchId?: string | undefined }>(v: T) =>
  Number(v.animalId !== undefined) + Number(v.batchId !== undefined) === 1;

const targetMessage = { message: "Isi tepat satu dari animalId atau batchId", path: ["animalId"] };

export const weightRecordCreate = z
  .object({
    animalId: uuid.optional(),
    batchId: uuid.optional(),
    measuredOn: pastOrToday,
    weightKg: z.number().positive().max(100_000),
    sampleSize: z.number().int().positive().optional(),
    clientId,
  })
  .refine(exactlyOneTarget, targetMessage);
export type WeightRecordCreate = z.infer<typeof weightRecordCreate>;

export const mortalityCauses = ["DISEASE", "INJURY", "PREDATION", "ENVIRONMENT", "UNKNOWN", "OTHER"] as const;

export const mortalityRecordCreate = z
  .object({
    animalId: uuid.optional(),
    batchId: uuid.optional(),
    occurredOn: pastOrToday,
    count: z.number().int().positive().max(10_000_000).default(1),
    cause: z.enum(mortalityCauses).default("UNKNOWN"),
    note: z.string().trim().max(500).optional(),
    clientId,
  })
  .refine(exactlyOneTarget, targetMessage)
  .refine((v) => v.animalId === undefined || v.count === 1, {
    message: "Mortalitas ternak individual selalu berjumlah 1",
    path: ["count"],
  });
export type MortalityRecordCreate = z.infer<typeof mortalityRecordCreate>;

export const voidRecord = z.object({
  reason: z.string().trim().min(3).max(300),
});
export type VoidRecord = z.infer<typeof voidRecord>;

// ---------------------------------------------------------------- Tahap 1

const money = z.number().nonnegative().max(1_000_000_000_000);
const feedName = z.string().trim().min(1).max(80);

/** Pemberian pakan untuk satu batch. Jenis pakan dicari lewat nama; bila belum ada, dibuat otomatis. */
export const feedRecordCreate = z.object({
  batchId: uuid,
  feedName,
  givenOn: pastOrToday,
  quantityKg: z.number().positive().max(10_000_000),
  costTotal: money.optional(),
  note: z.string().trim().max(500).optional(),
  clientId,
});
export type FeedRecordCreate = z.infer<typeof feedRecordCreate>;

export const productionKinds = ["EGG", "MILK", "HARVEST"] as const;
/** Satuan bawaan tiap jenis produksi. */
export const PRODUCTION_UNIT: Record<(typeof productionKinds)[number], string> = { EGG: "butir", MILK: "liter", HARVEST: "kg" };

export const productionRecordCreate = z.object({
  batchId: uuid,
  kind: z.enum(productionKinds),
  quantity: z.number().positive().max(100_000_000),
  producedOn: pastOrToday,
  note: z.string().trim().max(500).optional(),
  clientId,
});
export type ProductionRecordCreate = z.infer<typeof productionRecordCreate>;

/** Perpindahan populasi batch: jual, afkir, tambah, atau koreksi. Tanda delta ditentukan dari jenisnya. */
export const batchEventTypes = ["SOLD", "CULLED", "ADDED", "ADJUSTMENT"] as const;
export const batchEventCreate = z
  .object({
    eventType: z.enum(batchEventTypes),
    count: z.number().int().positive().max(10_000_000),
    /** Hanya dipakai untuk ADJUSTMENT: true = menambah populasi, false = mengurangi. */
    increase: z.boolean().optional(),
    occurredOn: pastOrToday,
    note: z.string().trim().max(500).optional(),
    clientId,
  })
  .refine((v) => v.eventType !== "ADJUSTMENT" || v.increase !== undefined, {
    message: "Koreksi harus menyebut menambah atau mengurangi",
    path: ["increase"],
  });
export type BatchEventCreate = z.infer<typeof batchEventCreate>;

/** Delta bertanda untuk sebuah perpindahan populasi. */
export function batchEventDelta(v: Pick<BatchEventCreate, "eventType" | "count" | "increase">): number {
  if (v.eventType === "ADDED") return v.count;
  if (v.eventType === "ADJUSTMENT") return v.increase ? v.count : -v.count;
  return -v.count; // SOLD, CULLED
}

const dateOnly = z.coerce.date();
export const taskCreate = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  dueOn: dateOnly,
  batchId: uuid.optional(),
  assignedTo: uuid.optional(),
});
export type TaskCreate = z.infer<typeof taskCreate>;

export const taskUpdate = z
  .object({
    status: z.enum(["OPEN", "DONE"]),
  })
  .partial()
  .extend({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    dueOn: dateOnly.optional(),
    assignedTo: uuid.nullable().optional(),
  });
export type TaskUpdate = z.infer<typeof taskUpdate>;

// ---------------------------------------------------------------- Tahap 2: Kesehatan

export const healthKinds = ["VACCINATION", "TREATMENT", "QUARANTINE"] as const;
const anyDate = z.coerce.date();

/**
 * Catatan kesehatan satu batch.
 * - VACCINATION: eventOn = tanggal jadwal (boleh di masa depan); selesai bila doneOn diisi.
 * - TREATMENT / QUARANTINE: eventOn = tanggal mulai, aktif sampai ditandai selesai.
 */
export const healthRecordCreate = z
  .object({
    batchId: uuid,
    kind: z.enum(healthKinds),
    title: z.string().trim().min(1).max(160),
    medicine: z.string().trim().max(120).optional(),
    dose: z.string().trim().max(120).optional(),
    affectedCount: z.number().int().positive().max(10_000_000).optional(),
    eventOn: anyDate,
    done: z.boolean().optional(),
    withdrawalUntil: anyDate.optional(),
    cost: money.optional(),
    note: z.string().trim().max(500).optional(),
    clientId,
  })
  .refine((v) => v.kind === "VACCINATION" || v.eventOn.getTime() <= Date.now() + 24 * 60 * 60 * 1000, { message: "Tanggal mulai tidak boleh di masa depan", path: ["eventOn"] })
  .refine((v) => !v.withdrawalUntil || v.withdrawalUntil >= v.eventOn, { message: "Masa henti obat tidak boleh sebelum tanggal mulai", path: ["withdrawalUntil"] });
export type HealthRecordCreate = z.infer<typeof healthRecordCreate>;

export const healthRecordComplete = z.object({ doneOn: anyDate.optional() });

// ---------------------------------------------------------------- Tahap 3: Marketplace

export const listingCategories = ["LIVESTOCK", "FEED", "MEDICINE", "EQUIPMENT", "PRODUCE"] as const;
export const listingUnits = ["ekor", "kg", "butir", "liter", "karung", "paket", "unit"] as const;

export const vendorProfileUpsert = z.object({
  displayName: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(80),
  /** Nomor WhatsApp/telepon yang tampil ke pembeli. */
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{7,18}$/, "Nomor telepon tidak valid"),
  about: z.string().trim().max(500).optional(),
});

export const listingCreate = z.object({
  title: z.string().trim().min(3).max(120),
  category: z.enum(listingCategories),
  description: z.string().trim().max(1000).optional(),
  priceIdr: money,
  unit: z.enum(listingUnits),
  stock: z.number().nonnegative().max(100_000_000),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
});
export type ListingCreate = z.infer<typeof listingCreate>;

export const listingUpdate = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000),
    priceIdr: money,
    stock: z.number().nonnegative().max(100_000_000),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Tidak ada perubahan" });

export const marketOrderCreate = z.object({
  listingId: uuid,
  quantity: z.number().positive().max(100_000_000),
  note: z.string().trim().max(500).optional(),
  clientId,
});

export const marketOrderActions = ["ACCEPT", "REJECT", "SHIP", "COMPLETE", "CANCEL"] as const;
export const marketOrderAction = z.object({ action: z.enum(marketOrderActions) });

export const marketReviewCreate = z.object({
  orderId: uuid,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------- Tahap 4: Keuangan

/** Kategori yang diinput manual. Pakan dan kesehatan dihitung otomatis dari modulnya (jangan diinput ganda). */
export const EXPENSE_CATEGORIES = ["BIBIT", "TENAGA_KERJA", "LISTRIK_AIR", "TRANSPORT", "PERALATAN", "SEWA", "LAINNYA"] as const;
export const INCOME_CATEGORIES = ["PENJUALAN_TERNAK", "PENJUALAN_HASIL", "LAINNYA"] as const;
/** Kategori anggaran = pengeluaran manual + dua kategori otomatis. */
export const BUDGET_CATEGORIES = ["PAKAN", "KESEHATAN", ...EXPENSE_CATEGORIES] as const;
const monthStr = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM");
const positiveMoney = z.number().positive().max(1_000_000_000_000);

export const financeEntryCreate = z
  .object({
    kind: z.enum(["INCOME", "EXPENSE"]),
    category: z.string(),
    amount: positiveMoney,
    occurredOn: pastOrToday,
    batchId: uuid.optional(),
    description: z.string().trim().max(300).optional(),
    clientId,
  })
  .refine((v) => (v.kind === "INCOME" ? (INCOME_CATEGORIES as readonly string[]) : (EXPENSE_CATEGORIES as readonly string[])).includes(v.category), { message: "Kategori tidak sesuai jenis transaksi", path: ["category"] });

export const budgetUpsert = z.object({
  month: monthStr,
  items: z.array(z.object({ category: z.enum(BUDGET_CATEGORIES), amount: z.number().nonnegative().max(1_000_000_000_000) })).min(1).max(BUDGET_CATEGORIES.length),
});
export const financeMonthQuery = monthStr;

export const invoiceCreate = z
  .object({
    customerName: z.string().trim().min(2).max(120),
    customerContact: z.string().trim().max(120).optional(),
    batchId: uuid.optional(),
    issueOn: anyDate,
    dueOn: anyDate,
    description: z.string().trim().max(500).optional(),
    amount: positiveMoney,
  })
  .refine((v) => v.dueOn >= v.issueOn, { message: "Jatuh tempo tidak boleh sebelum tanggal terbit", path: ["dueOn"] });

export const invoicePay = z.object({ paidOn: pastOrToday.optional(), category: z.enum(INCOME_CATEGORIES).default("PENJUALAN_TERNAK") });
