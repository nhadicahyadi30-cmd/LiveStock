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
