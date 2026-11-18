import { metricName, uuid } from "@sl/validation";
import { loadDevice } from "@/server/iot";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/iot/devices/:id/readings?metric=temperature&hours=24 -> deret waktu (rata-rata per ember, maks. ~150 titik)
export const GET = tenantRoute<{ id: string }>({ permission: "iot.read" }, async (c) => {
  const d = await loadDevice(c, uuid.parse(c.params.id));
  const url = new URL(c.req.url);
  const metric = metricName.parse(url.searchParams.get("metric") ?? "");
  const hours = Math.min(Math.max(Number(url.searchParams.get("hours")) || 24, 1), 24 * 30);
  const bucketSec = Math.max(60, Math.ceil((hours * 3600) / 150 / 60) * 60);
  const rows = await c.tx.$queryRaw<{ t: Date; v: number; mn: number; mx: number }[]>`
    SELECT to_timestamp(floor(extract(epoch FROM recorded_at) / ${bucketSec}) * ${bucketSec}) AS t,
           avg(value)::float8 AS v, min(value)::float8 AS mn, max(value)::float8 AS mx
    FROM sensor_readings
    WHERE device_id = ${d.id}::uuid AND metric = ${metric} AND recorded_at > now() - make_interval(hours => ${hours}::int)
    GROUP BY 1 ORDER BY 1`;
  return Response.json({ data: { metric, hours, bucketSeconds: bucketSec, points: rows.map((r) => ({ t: r.t, v: r.v, min: r.mn, max: r.mx })) } });
});
