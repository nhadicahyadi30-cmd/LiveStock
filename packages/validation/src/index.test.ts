import { describe, expect, it } from "vitest";
import { code, farmCreate, mortalityRecordCreate, weightRecordCreate } from "./index";

const id = "0192f0a0-0000-7000-8000-000000000001";
const id2 = "0192f0a0-0000-7000-8000-000000000002";

describe("code", () => {
  it("menerima kode wajar dan menolak spasi atau karakter aneh", () => {
    expect(code.safeParse("SAPI-001").success).toBe(true);
    expect(code.safeParse("sapi 001").success).toBe(false);
    expect(code.safeParse("").success).toBe(false);
    expect(code.safeParse("x".repeat(33)).success).toBe(false);
  });
});

describe("farmCreate", () => {
  it("tidak menerima organizationId dari request (diabaikan oleh skema)", () => {
    const parsed = farmCreate.parse({ name: "Farm Utara", code: "FU", organizationId: id });
    expect(parsed).not.toHaveProperty("organizationId");
  });
});

describe("weightRecordCreate", () => {
  const base = { measuredOn: "2026-11-01", weightKg: 250 };

  it("menerima tepat satu target", () => {
    expect(weightRecordCreate.safeParse({ ...base, animalId: id }).success).toBe(true);
    expect(weightRecordCreate.safeParse({ ...base, batchId: id }).success).toBe(true);
  });

  it("menolak tanpa target atau dengan dua target", () => {
    expect(weightRecordCreate.safeParse(base).success).toBe(false);
    expect(weightRecordCreate.safeParse({ ...base, animalId: id, batchId: id2 }).success).toBe(false);
  });

  it("menolak bobot nol atau negatif dan tanggal masa depan", () => {
    expect(weightRecordCreate.safeParse({ ...base, animalId: id, weightKg: 0 }).success).toBe(false);
    expect(weightRecordCreate.safeParse({ ...base, animalId: id, weightKg: -5 }).success).toBe(false);
    expect(weightRecordCreate.safeParse({ ...base, animalId: id, measuredOn: "2999-01-01" }).success).toBe(false);
  });
});

describe("mortalityRecordCreate", () => {
  it("memberi nilai bawaan jumlah 1 dan penyebab UNKNOWN", () => {
    const parsed = mortalityRecordCreate.parse({ animalId: id, occurredOn: "2026-11-01" });
    expect(parsed.count).toBe(1);
    expect(parsed.cause).toBe("UNKNOWN");
  });

  it("mortalitas ternak individual harus berjumlah 1; batch boleh lebih", () => {
    expect(mortalityRecordCreate.safeParse({ animalId: id, occurredOn: "2026-11-01", count: 2 }).success).toBe(false);
    expect(mortalityRecordCreate.safeParse({ batchId: id, occurredOn: "2026-11-01", count: 12 }).success).toBe(true);
  });

  it("menolak jumlah nol atau pecahan", () => {
    expect(mortalityRecordCreate.safeParse({ batchId: id, occurredOn: "2026-11-01", count: 0 }).success).toBe(false);
    expect(mortalityRecordCreate.safeParse({ batchId: id, occurredOn: "2026-11-01", count: 1.5 }).success).toBe(false);
  });
});

import { batchEventCreate, batchEventDelta, feedRecordCreate, productionRecordCreate, taskCreate, healthRecordCreate } from "./index";

describe("tahap 1", () => {
  const id = "0192f0a0-0000-7000-8000-00000000d003";
  it("delta perpindahan: jual dan afkir mengurangi, tambah menambah", () => {
    expect(batchEventDelta({ eventType: "SOLD", count: 10 })).toBe(-10);
    expect(batchEventDelta({ eventType: "CULLED", count: 3 })).toBe(-3);
    expect(batchEventDelta({ eventType: "ADDED", count: 5 })).toBe(5);
    expect(batchEventDelta({ eventType: "ADJUSTMENT", count: 2, increase: false })).toBe(-2);
  });
  it("koreksi wajib menyebut arah", () => {
    expect(batchEventCreate.safeParse({ eventType: "ADJUSTMENT", count: 1, occurredOn: "2026-01-01" }).success).toBe(false);
    expect(batchEventCreate.safeParse({ eventType: "SOLD", count: 1, occurredOn: "2026-01-01" }).success).toBe(true);
  });
  it("pakan dan produksi menolak jumlah nol atau negatif", () => {
    expect(feedRecordCreate.safeParse({ batchId: id, feedName: "Pelet", givenOn: "2026-01-01", quantityKg: 0 }).success).toBe(false);
    expect(productionRecordCreate.safeParse({ batchId: id, kind: "EGG", quantity: -1, producedOn: "2026-01-01" }).success).toBe(false);
    expect(productionRecordCreate.safeParse({ batchId: id, kind: "EGG", quantity: 120, producedOn: "2026-01-01" }).success).toBe(true);
  });
  it("tugas butuh judul dan tanggal", () => {
    expect(taskCreate.safeParse({ title: " ", dueOn: "2026-01-01" }).success).toBe(false);
    expect(taskCreate.safeParse({ title: "Vaksin", dueOn: "2026-01-01" }).success).toBe(true);
  });
});

describe("tahap 2: kesehatan", () => {
  const base = { batchId: "0192f3a0-0000-7000-8000-000000000001", title: "ND-IB" };
  it("vaksinasi boleh dijadwalkan di masa depan", () => {
    expect(healthRecordCreate.safeParse({ ...base, kind: "VACCINATION", eventOn: "2099-01-01" }).success).toBe(true);
  });
  it("pengobatan tidak boleh dimulai di masa depan", () => {
    expect(healthRecordCreate.safeParse({ ...base, kind: "TREATMENT", eventOn: "2099-01-01" }).success).toBe(false);
  });
  it("masa henti obat tidak boleh sebelum mulai", () => {
    expect(healthRecordCreate.safeParse({ ...base, kind: "TREATMENT", eventOn: "2024-05-10", withdrawalUntil: "2024-05-01" }).success).toBe(false);
  });
});
