# API terbuka dan webhook

## Kunci API (baca-saja)
Buat di menu **Integrasi** (khusus pemilik). Nilai kunci hanya tampil sekali. Kirim di header:

```
Authorization: Bearer nt_key_...
```

| Endpoint | Isi |
|---|---|
| `GET /api/open/v1/farms` | Daftar farm |
| `GET /api/open/v1/batches?status=ACTIVE` | Batch dan populasi saat ini |
| `GET /api/open/v1/feed-records?batchId=&since=YYYY-MM-DD&limit=` | Catatan pakan |
| `GET /api/open/v1/production-records?batchId=&since=&limit=` | Catatan produksi |
| `GET /api/open/v1/alerts?open=true` | Alarm sensor |

Batas: 60 permintaan per menit per kunci (memori proses). Kunci yang dicabut langsung ditolak. Data yang terbaca selalu terbatas pada organisasi pemilik kunci (RLS).

## Webhook
Event: `iot.alert.opened`, `iot.alert.resolved`, `feed_record.created`, `production_record.created`, `health_record.created`, serta `ping` untuk uji.

Isi kiriman:
```json
{ "event": "iot.alert.opened", "createdAt": "2026-11-22T01:00:00.000Z", "data": { "device": "Sensor Kandang A", "metric": "temperature", "value": 34.2 } }
```
Header: `X-NT-Event`, `X-NT-Delivery`, `X-NT-Timestamp`, `X-NT-Signature: sha256=<hex>` dengan `HMAC_SHA256(rahasia, timestamp + "." + isi_mentah)`.

Verifikasi (Node.js):
```js
const crypto = require("crypto");
function valid(secret, ts, rawBody, sig) {
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const want = "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
```

Pengiriman: jawab 2xx untuk dianggap terkirim. Gagal dicoba ulang (1, 5, 30, 120 menit) sampai 5 kali, lalu berstatus Gagal (bisa dikirim ulang manual).

Keamanan: hanya `https` ke alamat publik. Alamat lokal/internal ditolak (anti-SSRF). Untuk Node-RED lokal saat pengembangan, set `ALLOW_PRIVATE_WEBHOOKS=true`. Pengiriman dijalankan ±1,5 detik setelah event oleh server Node; bila hosting serverless, jadwalkan `POST /api/operator/webhooks/flush` tiap menit dengan header `x-operator-token`.
