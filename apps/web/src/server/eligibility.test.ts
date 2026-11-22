import { describe, expect, it } from "vitest";
import { summarizeEligibility } from "./eligibility";

describe("summarizeEligibility", () => {
  const s = (income: number, expense: number, month = "2026-01") => ({ month, income, expense });
  it("menghitung laba, margin, dan bulan untung", () => {
    const e = summarizeEligibility([s(1000, 600), s(1000, 1200), s(1000, 500)], 2, 0);
    expect(e.profit).toBe(700); expect(e.marginPct).toBe(23.3); expect(e.profitableMonths).toBe(2); expect(e.dataQuality).toBe("cukup");
  });
  it("data kurang dari 3 bulan diberi catatan", () => {
    const e = summarizeEligibility([s(0, 0), s(500, 100), s(0, 0)], 1, 0);
    expect(e.dataQuality).toBe("kurang"); expect(e.notes.length).toBeGreaterThan(0);
  });
  it("tanpa pemasukan margin null", () => { expect(summarizeEligibility([s(0, 50)], 0, 0).marginPct).toBeNull(); });
});
