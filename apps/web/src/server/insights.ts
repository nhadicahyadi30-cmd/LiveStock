// Smart Ternak AI (tahap awal): statistik sederhana yang transparan, bukan model pembelajaran mesin.
// Semua fungsi di sini murni (tanpa database) agar mudah diuji. Hasilnya adalah ESTIMASI dari catatan pengguna.

export type Severity = "info" | "warn" | "high";
export interface Insight { kind: string; severity: Severity; title: string; detail: string }

const DAY = 864e5;
export const dayIndex = (d: Date) => Math.floor(d.getTime() / DAY);

export interface WeightPoint { date: Date; kg: number }

/** Regresi linear kuadrat terkecil. r2 = seberapa baik garis cocok dengan data (0..1). */
export function linearFit(pts: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); syy += (p.y - my) ** 2; }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
}

export type Confidence = "tinggi" | "sedang" | "rendah";
export interface GrowthForecast {
  slopeKgPerDay: number; r2: number; confidence: Confidence; points: number;
  currentKg: number; kgIn7d: number; kgIn14d: number; kgIn30d: number;
  target?: { kg: number; reached: boolean; date: string | null; days: number | null };
}

/**
 * Perkiraan bobot dari garis tren 8 penimbangan terakhir. Minimal 3 titik dalam rentang >= 6 hari.
 * Tren dianggap linear (pertumbuhan nyata melambat mendekati dewasa, jadi jauhkan kepercayaan untuk proyeksi panjang).
 */
export function forecastGrowth(weights: WeightPoint[], targetKg?: number, now: Date = new Date()): GrowthForecast | { error: string } {
  const sorted = [...weights].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-8);
  if (sorted.length < 3) return { error: "Butuh minimal 3 catatan bobot untuk membuat perkiraan." };
  const x0 = dayIndex(sorted[0]!.date);
  const pts = sorted.map((w) => ({ x: dayIndex(w.date) - x0, y: w.kg }));
  if (pts[pts.length - 1]!.x < 6) return { error: "Catatan bobot harus mencakup rentang minimal 6 hari." };
  const fit = linearFit(pts);
  if (!fit) return { error: "Data bobot belum cukup bervariasi." };

  const lastX = pts[pts.length - 1]!.x;
  const at = (d: number) => Math.max(0, Math.round((fit.intercept + fit.slope * (lastX + d)) * 1000) / 1000);
  const current = sorted[sorted.length - 1]!.kg;
  const confidence: Confidence = pts.length >= 5 && fit.r2 >= 0.9 ? "tinggi" : pts.length >= 4 && fit.r2 >= 0.75 ? "sedang" : "rendah";
  const out: GrowthForecast = { slopeKgPerDay: fit.slope, r2: fit.r2, confidence, points: pts.length, currentKg: current, kgIn7d: at(7), kgIn14d: at(14), kgIn30d: at(30) };

  if (targetKg !== undefined && targetKg > 0) {
    if (current >= targetKg) out.target = { kg: targetKg, reached: true, date: null, days: 0 };
    else if (fit.slope > 0) {
      const days = Math.ceil((targetKg - (fit.intercept + fit.slope * lastX)) / fit.slope);
      const when = new Date(dayIndex(sorted[sorted.length - 1]!.date) * DAY + days * DAY);
      out.target = days > 365 ? { kg: targetKg, reached: false, date: null, days: null } : { kg: targetKg, reached: false, date: when.toISOString().slice(0, 10), days: Math.max(days, 0) };
    } else out.target = { kg: targetKg, reached: false, date: null, days: null };
  }
  void now;
  return out;
}

/** Feed Conversion Ratio = kg pakan / kg pertambahan bobot total. Hanya bila pakan tercatat dan bobot naik. */
export function computeFcr(feedKg: number, startAvgKg: number, endAvgKg: number, population: number): number | null {
  const gain = (endAvgKg - startAvgKg) * population;
  if (feedKg <= 0 || gain <= 0 || population <= 0) return null;
  return Math.round((feedKg / gain) * 100) / 100;
}

/** Lonjakan kematian: 2 hari terakhir dibanding rata-rata harian 14 hari sebelumnya. */
export function detectMortalitySpike(dailyDeaths: Map<number, number>, population: number, todayIdx: number): Insight | null {
  const sum = (from: number, to: number) => { let s = 0; for (let d = from; d <= to; d++) s += dailyDeaths.get(d) ?? 0; return s; };
  const recent = sum(todayIdx - 1, todayIdx);
  const baselinePerDay = sum(todayIdx - 15, todayIdx - 2) / 14;
  if (recent < 2) return null;
  const pct = population > 0 ? (recent / (population + recent)) * 100 : 0;
  const spike = recent >= Math.max(3, 3 * baselinePerDay * 2);
  if (!spike && pct < 1) return null;
  return {
    kind: "mortality_spike", severity: pct >= 2 || recent >= 10 ? "high" : "warn", title: "Kematian meningkat",
    detail: `${recent} ekor mati dalam 2 hari terakhir (biasanya ±${(baselinePerDay * 2).toFixed(1)} per 2 hari, sekitar ${pct.toFixed(1)}% populasi). Periksa kandang, air minum, dan pakan; hubungi dokter hewan bila berlanjut.`,
  };
}

/** Nafsu makan turun: rata-rata pakan 3 hari terakhir jauh di bawah 7 hari sebelumnya. */
export function detectFeedDrop(dailyFeedKg: Map<number, number>, todayIdx: number): Insight | null {
  const avg = (from: number, to: number) => { let s = 0, n = 0; for (let d = from; d <= to; d++) { const v = dailyFeedKg.get(d); if (v !== undefined) { s += v; n++; } } return { avg: n ? s / n : 0, n }; };
  const recent = avg(todayIdx - 2, todayIdx);
  const prior = avg(todayIdx - 9, todayIdx - 3);
  if (recent.n < 2 || prior.n < 4 || prior.avg <= 0) return null;
  const drop = 1 - recent.avg / prior.avg;
  if (drop < 0.3) return null;
  return { kind: "feed_drop", severity: drop >= 0.5 ? "high" : "warn", title: "Konsumsi pakan turun", detail: `Rata-rata pakan 3 hari terakhir turun ${Math.round(drop * 100)}% dibanding minggu sebelumnya. Penurunan nafsu makan sering jadi tanda awal stres atau sakit.` };
}

/** Bobot rata-rata turun dari penimbangan sebelumnya (lebih dari 3%). */
export function detectWeightDrop(weights: WeightPoint[]): Insight | null {
  const s = [...weights].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (s.length < 2) return null;
  const prev = s[s.length - 2]!, last = s[s.length - 1]!;
  if (prev.kg <= 0) return null;
  const change = (last.kg - prev.kg) / prev.kg;
  if (change > -0.03) return null;
  return { kind: "weight_drop", severity: change <= -0.08 ? "high" : "warn", title: "Bobot rata-rata turun", detail: `Penimbangan terakhir ${last.kg} kg, turun ${Math.abs(Math.round(change * 100))}% dari sebelumnya (${prev.kg} kg). Pastikan bukan salah timbang, lalu periksa pakan dan kesehatan.` };
}

/** Median untuk membandingkan FCR antarbatch. */
export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
