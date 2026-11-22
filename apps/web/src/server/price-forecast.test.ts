import { describe, expect, it } from "vitest";
import { forecastPrice } from "./price-forecast";

const now = new Date("2026-11-20T00:00:00Z");
const day = (n: number) => new Date(now.getTime() - n * 864e5);

describe("forecastPrice", () => {
  it("kosong → catatan", () => { expect(forecastPrice([], now).note).toMatch(/Belum ada/); });
  it("kurang dari 3 titik → tanpa perkiraan", () => {
    const f = forecastPrice([{ date: day(5), price: 100 }, { date: day(1), price: 110 }], now);
    expect(f.in7d).toBeNull(); expect(f.latest).toBe(110);
  });
  it("tren naik linear diproyeksikan naik", () => {
    const pts = [20, 15, 10, 5, 0].map((d, i) => ({ date: day(d), price: 20000 + i * 500 }));
    const f = forecastPrice(pts, now);
    expect(f.trend).toBe("naik"); expect(f.in7d!).toBeGreaterThan(22000); expect(f.confidence).not.toBe("rendah");
  });
  it("harga datar → stabil", () => {
    const pts = [18, 12, 6, 0].map((d) => ({ date: day(d), price: 30000 }));
    expect(forecastPrice(pts, now).trend).toBe("stabil");
  });
  it("tren turun tidak menghasilkan harga negatif", () => {
    const pts = [10, 7, 4, 1].map((d, i) => ({ date: day(d), price: 1000 - i * 400 }));
    expect(forecastPrice(pts, now).in30d!).toBeGreaterThanOrEqual(0);
  });
  it("perubahan 30 hari dibanding 30 hari sebelumnya", () => {
    const pts = [{ date: day(45), price: 100 }, { date: day(40), price: 100 }, { date: day(10), price: 110 }, { date: day(2), price: 110 }];
    expect(forecastPrice(pts, now).changePct30d).toBe(10);
  });
});
