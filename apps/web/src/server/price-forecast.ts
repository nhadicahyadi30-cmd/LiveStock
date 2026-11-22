// Prediksi harga pasar: statistik sederhana dan transparan (tren linear + rata-rata bergerak), bukan model ML.
// Murni (tanpa database) supaya mudah diuji. Hasilnya ESTIMASI dari harga yang dicatat pengguna.
import { dayIndex, linearFit } from "./insights";

export interface PricePoint { date: Date; price: number }
export type Trend = "naik" | "turun" | "stabil";
export interface PriceForecast {
  points: number; latest: number; average30d: number | null; changePct30d: number | null;
  trend: Trend; confidence: "tinggi" | "sedang" | "rendah";
  in7d: number | null; in14d: number | null; in30d: number | null;
  band: number | null; // simpangan baku sisa, dipakai sebagai kisaran ±
  note: string | null;
}

export function forecastPrice(input: PricePoint[], now = new Date()): PriceForecast {
  const pts = [...input].sort((a, b) => a.date.getTime() - b.date.getTime());
  const base: PriceForecast = { points: pts.length, latest: pts.at(-1)?.price ?? 0, average30d: null, changePct30d: null, trend: "stabil", confidence: "rendah", in7d: null, in14d: null, in30d: null, band: null, note: null };
  if (pts.length === 0) return { ...base, note: "Belum ada catatan harga." };
  const today = dayIndex(now);
  const recent = pts.filter((p) => today - dayIndex(p.date) <= 30);
  if (recent.length > 0) base.average30d = round(recent.reduce((s, p) => s + p.price, 0) / recent.length);
  const prev = pts.filter((p) => { const d = today - dayIndex(p.date); return d > 30 && d <= 60; });
  if (recent.length && prev.length) {
    const a = recent.reduce((s, p) => s + p.price, 0) / recent.length;
    const b = prev.reduce((s, p) => s + p.price, 0) / prev.length;
    base.changePct30d = round(((a - b) / b) * 100);
  }
  if (pts.length < 3) return { ...base, note: "Butuh minimal 3 catatan harga untuk perkiraan." };
  const last = pts.slice(-12);
  const fit = linearFit(last.map((p) => ({ x: dayIndex(p.date), y: p.price })));
  if (!fit) return { ...base, note: "Catatan harga ada di hari yang sama; perkiraan belum bisa dihitung." };
  const at = (day: number) => Math.max(0, fit.intercept + fit.slope * day);
  const resid = last.map((p) => p.price - at(dayIndex(p.date)));
  const sd = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / Math.max(1, last.length - 2));
  const pctPerDay = base.latest > 0 ? (fit.slope / base.latest) * 100 : 0;
  const trend: Trend = Math.abs(pctPerDay * 30) < 2 ? "stabil" : pctPerDay > 0 ? "naik" : "turun";
  const confidence = last.length >= 6 && fit.r2 >= 0.6 ? "tinggi" : last.length >= 4 && fit.r2 >= 0.3 ? "sedang" : "rendah";
  return { ...base, trend, confidence, in7d: round(at(today + 7)), in14d: round(at(today + 14)), in30d: round(at(today + 30)), band: round(sd), note: confidence === "rendah" ? "Data masih sedikit atau berfluktuasi; anggap perkiraan ini kasar." : null };
}
const round = (n: number) => Math.round(n * 100) / 100;
