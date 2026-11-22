import { describe, expect, it } from "vitest";
import { PLANS, canAdd, effectivePlan, extendExpiry, planPrice } from "./plans";

const now = new Date("2026-11-20T00:00:00Z");
describe("plans", () => {
  it("batas: tepat di batas tidak boleh menambah", () => {
    expect(canAdd("FREE", "farms", PLANS.FREE.limits.farms! - 1)).toBe(true);
    expect(canAdd("FREE", "farms", PLANS.FREE.limits.farms!)).toBe(false);
  });
  it("enterprise tanpa batas", () => { expect(canAdd("ENTERPRISE", "devices", 1_000_000)).toBe(true); });
  it("paket berbayar kedaluwarsa jadi gratis", () => {
    expect(effectivePlan("PRO", new Date("2026-11-01T00:00:00Z"), now)).toBe("FREE");
    expect(effectivePlan("PRO", null, now)).toBe("FREE");
    expect(effectivePlan("PRO", new Date("2026-12-01T00:00:00Z"), now)).toBe("PRO");
  });
  it("harga = bulanan x bulan", () => { expect(planPrice("STARTER", 3)).toBe(297_000); });
  it("perpanjangan menambah dari sisa masa aktif", () => {
    expect(extendExpiry(new Date("2026-12-20T00:00:00Z"), 1, now).toISOString().slice(0, 10)).toBe("2027-01-20");
    expect(extendExpiry(new Date("2026-10-01T00:00:00Z"), 1, now).toISOString().slice(0, 10)).toBe("2026-12-20");
    expect(extendExpiry(null, 12, now).toISOString().slice(0, 10)).toBe("2027-11-20");
  });
});
