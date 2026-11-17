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
