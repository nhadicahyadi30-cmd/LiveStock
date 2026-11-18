import { uuid } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { loadDevice } from "@/server/iot";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/iot/devices/:id/simulate -> mengisi 24 jam data contoh (suhu, kelembapan, amonia) agar grafik bisa dicoba
// tanpa perangkat. Hanya untuk perangkat yang belum pernah mengirim data apa pun.
export const POST = tenantRoute<{ id: string }>({ permission: "iot.manage" }, async (c) => {
  const d = await loadDevice(c, uuid.parse(c.params.id));
  if ((await c.tx.sensorReading.count({ where: { deviceId: d.id } })) > 0) throw new ApiError(409, "HAS_DATA", "Perangkat ini sudah punya data; simulasi hanya untuk perangkat kosong");
  const now = Date.now(); const rows = [];
  for (let i = 288; i >= 0; i--) {
    const t = now - i * 5 * 60_000; const h = new Date(t).getUTCHours() + 7; const day = Math.sin(((h % 24) - 9) / 24 * 2 * Math.PI);
    const jitter = () => (Math.random() - 0.5);
    rows.push({ metric: "temperature", value: Math.round((29 + 4 * day + jitter()) * 10) / 10, recordedAt: new Date(t) });
    rows.push({ metric: "humidity", value: Math.round((68 - 10 * day + jitter() * 3) * 10) / 10, recordedAt: new Date(t) });
    rows.push({ metric: "ammonia", value: Math.round(Math.max(0, 12 + 4 * day + jitter() * 2) * 10) / 10, recordedAt: new Date(t) });
  }
  await c.tx.sensorReading.createMany({ data: rows.map((r) => ({ ...r, organizationId: c.organizationId, deviceId: d.id })) });
  await c.tx.device.update({ where: { id: d.id }, data: { lastSeenAt: new Date() } });
  return Response.json({ data: { inserted: rows.length } }, { status: 201 });
});
