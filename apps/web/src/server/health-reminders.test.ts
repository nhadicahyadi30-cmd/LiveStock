import { describe, expect, it } from "vitest";
import { reminderPhase, todayWib } from "./health-reminders";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("pengingat kesehatan", () => {
  it("todayWib memakai tanggal WIB", () => {
    expect(todayWib(new Date("2026-11-21T20:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-22");
  });
  it("fase soon, overdue, dan belum waktunya", () => {
    const t = d("2026-11-22");
    expect(reminderPhase(d("2026-11-22"), t)).toBe("soon");
    expect(reminderPhase(d("2026-11-25"), t)).toBe("soon");
    expect(reminderPhase(d("2026-11-26"), t)).toBe(null);
    expect(reminderPhase(d("2026-11-21"), t)).toBe("overdue");
  });
});
