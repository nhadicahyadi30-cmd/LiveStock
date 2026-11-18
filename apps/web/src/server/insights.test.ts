import { describe, expect, it } from "vitest";
import { computeFcr, detectFeedDrop, detectMortalitySpike, detectWeightDrop, dayIndex, forecastGrowth, linearFit, median } from "./insights";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("linearFit", () => {
  it("menemukan garis sempurna", () => {
    const f = linearFit([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])!;
    expect(f.slope).toBeCloseTo(2); expect(f.intercept).toBeCloseTo(1); expect(f.r2).toBeCloseTo(1);
  });
  it("null bila x semua sama", () => expect(linearFit([{ x: 1, y: 1 }, { x: 1, y: 2 }])).toBeNull());
});

describe("forecastGrowth", () => {
  const w = [{ date: d("2025-01-01"), kg: 1.0 }, { date: d("2025-01-08"), kg: 1.5 }, { date: d("2025-01-15"), kg: 2.0 }, { date: d("2025-01-22"), kg: 2.5 }];
  it("memproyeksikan bobot dan tanggal target", () => {
    const f = forecastGrowth(w, 3.5);
    if ("error" in f) throw new Error(f.error);
    expect(f.slopeKgPerDay).toBeCloseTo(0.5 / 7, 5);
    expect(f.kgIn14d).toBeCloseTo(3.5, 2);
    expect(f.target?.days).toBe(14);
    expect(f.target?.date).toBe("2025-02-05");
    expect(f.confidence).toBe("sedang");
  });
  it("menolak data terlalu sedikit atau terlalu pendek", () => {
    expect("error" in forecastGrowth(w.slice(0, 2))).toBe(true);
    expect("error" in forecastGrowth([{ date: d("2025-01-01"), kg: 1 }, { date: d("2025-01-02"), kg: 1.1 }, { date: d("2025-01-03"), kg: 1.2 }])).toBe(true);
  });
  it("target yang sudah tercapai dan tren turun", () => {
    const f = forecastGrowth(w, 2)!;
    if ("error" in f) throw new Error(f.error);
    expect(f.target?.reached).toBe(true);
    const down = forecastGrowth([{ date: d("2025-01-01"), kg: 3 }, { date: d("2025-01-08"), kg: 2.5 }, { date: d("2025-01-15"), kg: 2 }], 4)!;
    if ("error" in down) throw new Error(down.error);
    expect(down.target?.date).toBeNull();
  });
});

describe("computeFcr", () => {
  it("menghitung rasio konversi pakan", () => expect(computeFcr(300, 1, 2, 100)).toBe(3));
  it("null bila tidak ada pertambahan atau pakan", () => { expect(computeFcr(300, 2, 2, 100)).toBeNull(); expect(computeFcr(0, 1, 2, 100)).toBeNull(); });
});

describe("deteksi anomali", () => {
  const today = dayIndex(d("2025-02-01"));
  it("lonjakan kematian", () => {
    const m = new Map<number, number>([[today, 6], [today - 1, 4], [today - 5, 1]]);
    expect(detectMortalitySpike(m, 400, today)?.kind).toBe("mortality_spike");
    expect(detectMortalitySpike(new Map([[today, 1]]), 400, today)).toBeNull();
  });
  it("kematian rutin kecil tidak dianggap lonjakan", () => {
    const m = new Map<number, number>(); for (let i = 0; i < 16; i++) m.set(today - i, 1);
    expect(detectMortalitySpike(m, 5000, today)).toBeNull();
  });
  it("penurunan pakan", () => {
    const f = new Map<number, number>(); for (let i = 3; i <= 9; i++) f.set(today - i, 100); f.set(today, 40); f.set(today - 1, 45); f.set(today - 2, 50);
    expect(detectFeedDrop(f, today)?.kind).toBe("feed_drop");
    const ok = new Map(f); ok.set(today, 95); ok.set(today - 1, 100); ok.set(today - 2, 98);
    expect(detectFeedDrop(ok, today)).toBeNull();
  });
  it("bobot turun", () => {
    expect(detectWeightDrop([{ date: d("2025-01-01"), kg: 2 }, { date: d("2025-01-08"), kg: 1.9 }])?.severity).toBe("warn");
    expect(detectWeightDrop([{ date: d("2025-01-01"), kg: 2 }, { date: d("2025-01-08"), kg: 1.8 }])?.severity).toBe("high");
    expect(detectWeightDrop([{ date: d("2025-01-01"), kg: 2 }, { date: d("2025-01-08"), kg: 2.1 }])).toBeNull();
  });
});

describe("median", () => { it("ganjil dan genap", () => { expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(2.5); expect(median([])).toBeNull(); }); });
