import { uuid } from "@sl/validation";
import { METRIC_INFO } from "@sl/validation";
import { computeFcr, dayIndex, detectFeedDrop, detectMortalitySpike, detectWeightDrop, forecastGrowth, median, type Insight } from "@/server/insights";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

const DAY = 864e5;
const bucket = <T,>(rows: T[], key: (r: T) => string | null) => { const m = new Map<string, T[]>(); for (const r of rows) { const k = key(r); if (k) { const a = m.get(k); if (a) a.push(r); else m.set(k, [r]); } } return m; };

// GET /api/v1/ai/insights?targets=<batchId>:<kg>,...
// Estimasi statistik per batch aktif (perkiraan bobot dan panen, FCR, peringatan dini) + penyimpangan sensor IoT.
// Bukan diagnosis; hasilnya perkiraan dari catatan yang ada.
export const GET = tenantRoute({ permission: "dashboard.read" }, async (c) => {
  const url = new URL(c.req.url);
  const targets = new Map<string, number>();
  for (const part of (url.searchParams.get("targets") ?? "").split(",").slice(0, 100)) {
    const [id, kg] = part.split(":");
    if (id && kg && uuid.safeParse(id).success && Number(kg) > 0 && Number(kg) < 100000) targets.set(id, Number(kg));
  }

  const batches = await c.tx.livestockBatch.findMany({ where: { status: "ACTIVE", ...(c.allowedFarmIds ? { farmId: { in: c.allowedFarmIds } } : {}) }, orderBy: { startDate: "desc" }, take: 50 });
  const ids = batches.map((b) => b.id);
  const since = new Date(Date.now() - 120 * DAY);
  const [weights, feed, mort, pops] = await Promise.all([
    c.tx.weightRecord.findMany({ where: { voidedAt: null, batchId: { in: ids }, measuredOn: { gte: since } }, select: { batchId: true, measuredOn: true, weightKg: true } }),
    c.tx.feedRecord.findMany({ where: { voidedAt: null, batchId: { in: ids }, givenOn: { gte: since } }, select: { batchId: true, givenOn: true, quantityKg: true } }),
    c.tx.mortalityRecord.findMany({ where: { voidedAt: null, batchId: { in: ids }, occurredOn: { gte: since } }, select: { batchId: true, occurredOn: true, count: true } }),
    ids.length ? c.tx.$queryRaw<{ batch_id: string; current_count: number }[]>`SELECT batch_id, current_count::int AS current_count FROM batch_population` : Promise.resolve([]),
  ]);
  const pop = new Map(pops.map((p) => [p.batch_id, p.current_count]));
  const wBy = bucket(weights, (r) => r.batchId), fBy = bucket(feed, (r) => r.batchId), mBy = bucket(mort, (r) => r.batchId);
  const todayIdx = dayIndex(new Date());

  const rows = batches.map((b) => {
    const w = (wBy.get(b.id) ?? []).map((r) => ({ date: r.measuredOn, kg: Number(r.weightKg) })).sort((a, z) => a.date.getTime() - z.date.getTime());
    const population = pop.get(b.id) ?? b.initialCount;
    const insights: Insight[] = [];

    const fc = forecastGrowth(w, targets.get(b.id));
    const dailyFeed = new Map<number, number>();
    for (const r of fBy.get(b.id) ?? []) dailyFeed.set(dayIndex(r.givenOn), (dailyFeed.get(dayIndex(r.givenOn)) ?? 0) + Number(r.quantityKg));
    const dailyDeaths = new Map<number, number>();
    for (const r of mBy.get(b.id) ?? []) dailyDeaths.set(dayIndex(r.occurredOn), (dailyDeaths.get(dayIndex(r.occurredOn)) ?? 0) + r.count);

    for (const i of [detectMortalitySpike(dailyDeaths, population, todayIdx), detectFeedDrop(dailyFeed, todayIdx), detectWeightDrop(w)]) if (i) insights.push(i);

    // FCR: pakan yang diberikan antara penimbangan pertama dan terakhir dibanding pertambahan bobot seluruh populasi.
    let fcr: number | null = null;
    if (w.length >= 2) {
      const a = dayIndex(w[0]!.date), z = dayIndex(w[w.length - 1]!.date);
      let feedKg = 0; for (const [d, kg] of dailyFeed) if (d > a && d <= z) feedKg += kg;
      fcr = computeFcr(feedKg, w[0]!.kg, w[w.length - 1]!.kg, population);
    }
    const adg = !("error" in fc) ? fc.slopeKgPerDay * 1000 : null;
    return { id: b.id, code: b.code, population, weights: w.map((x) => ({ date: x.date.toISOString().slice(0, 10), kg: x.kg })), forecast: fc, adgGramPerDay: adg === null ? null : Math.round(adg * 10) / 10, fcr, insights };
  });

  // Bandingkan FCR antarbatch milik usaha ini (bukan standar luar): hanya bila ada >= 3 batch ber-FCR.
  const med = median(rows.map((r) => r.fcr).filter((x): x is number => x !== null));
  const fcrCount = rows.filter((r) => r.fcr !== null).length;
  for (const r of rows) {
    if (r.fcr !== null && med !== null && fcrCount >= 3 && r.fcr > med * 1.2) r.insights.push({ kind: "fcr_high", severity: "info", title: "FCR lebih boros dari batch lain", detail: `FCR ${r.fcr} dibanding median batch lain di usahamu ${med.toFixed(2)}. Cek kualitas pakan, ukuran porsi, dan pakan terbuang.` });
  }

  // Sensor yang menyimpang dari kebiasaannya: rata-rata 3 jam terakhir vs 7 hari sebelumnya.
  const devices = await c.tx.device.findMany({ where: { status: "ACTIVE", ...(c.allowedFarmIds ? { farmId: { in: c.allowedFarmIds } } : {}) }, select: { id: true, name: true } });
  const devName = new Map(devices.map((d) => [d.id, d.name]));
  const sensor: Insight[] = [];
  if (devices.length) {
    const odd = await c.tx.$queryRaw<{ device_id: string; metric: string; recent: number; base: number; sd: number }[]>`
      WITH recent AS (SELECT device_id, metric, avg(value) a FROM sensor_readings WHERE recorded_at > now() - interval '3 hours' GROUP BY 1, 2),
           base AS (SELECT device_id, metric, avg(value) m, COALESCE(stddev_samp(value), 0) s FROM sensor_readings
                    WHERE recorded_at BETWEEN now() - interval '8 days' AND now() - interval '3 hours' GROUP BY 1, 2 HAVING count(*) >= 100)
      SELECT r.device_id, r.metric, r.a::float8 AS recent, b.m::float8 AS base, b.s::float8 AS sd
      FROM recent r JOIN base b USING (device_id, metric)
      WHERE r.device_id = ANY(${devices.map((d) => d.id)}::uuid[]) AND abs(r.a - b.m) > 3 * greatest(b.s, 0.05 * abs(b.m), 0.1)`;
    for (const o of odd) {
      const info = METRIC_INFO[o.metric];
      sensor.push({ kind: "sensor_anomaly", severity: "warn", title: `${devName.get(o.device_id) ?? "Sensor"}: ${info?.label ?? o.metric} tidak biasa`, detail: `Rata-rata 3 jam terakhir ${o.recent.toFixed(1)}${info?.unit ?? ""}, padahal 7 hari sebelumnya biasanya ${o.base.toFixed(1)}${info?.unit ?? ""} (±${o.sd.toFixed(1)}). Periksa kandang atau sensornya.` });
    }
  }

  return Response.json({ data: { generatedAt: new Date().toISOString(), batches: rows, sensor } });
});
