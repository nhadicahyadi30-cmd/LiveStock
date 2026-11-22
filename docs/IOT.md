# Smart Ternak IoT: menyambungkan perangkat kandang

Perangkat (ESP32, gateway, Raspberry Pi, atau Node-RED) berbicara ke Nusa Ternak lewat **HTTP + JSON**.
Tidak butuh login: tiap perangkat punya **token** sendiri.

## 1. Daftarkan perangkat
Di aplikasi: menu **Smart Ternak IoT → Tambah perangkat**, pilih farm dan nama kandang.
Token (`nt_dev_...`) hanya tampil **sekali**. Hilang? Buka halaman perangkat → **Token baru** (token lama langsung mati).

## 2. Kirim data sensor
```
POST {BASE_URL}/api/iot/v1/readings
Authorization: Bearer nt_dev_xxxxxxxx
Content-Type: application/json
```
Tiga bentuk isi yang diterima:

| Bentuk | Contoh |
|---|---|
| Datar (paling mudah dari Node-RED) | `{"temperature": 28.4, "humidity": 70}` |
| Satu metrik | `{"metric": "ph", "value": 7.2}` |
| Banyak | `{"readings": [{"metric": "temperature", "value": 28.4, "ts": 1731980000}]}` |

- Nama metrik bebas: huruf kecil, angka, garis bawah (maks. 40), mis. `temperature`, `humidity`, `ammonia`, `ph`, `dissolved_oxygen`, `water_temp`, `salinity`, `feed_weight`.
- `ts` opsional (ISO 8601 atau epoch detik/milidetik). Tanpa `ts` dipakai waktu server. Untuk data yang tertahan saat offline, kirim dengan `ts` aslinya (maks. 7 hari ke belakang, maks. 5 menit ke depan).
- Maks. 50 pembacaan per permintaan, maks. 120 permintaan per menit per perangkat.
- Respons sukses `201`: `{"data":{"accepted":3,"rejected":0,"alerts":0}}`.

Uji koneksi: `GET {BASE_URL}/api/iot/v1/ping` dengan header yang sama.

## 3. Perintah ke perangkat (pakan/minum otomatis, kipas, dll.)
Pengguna mengirim perintah dari halaman perangkat. Perangkat **menarik** perintah (polling), jadi tidak perlu port terbuka di kandang:

```
GET  {BASE_URL}/api/iot/v1/commands            -> {"data":[{"id":"...","command":"feeder_on","payload":{"value":10}}]}
POST {BASE_URL}/api/iot/v1/commands/{id}/ack   {"result":"ok"}
```
Perintah yang sudah diambil berstatus *Terkirim*, setelah `ack` menjadi *Dikonfirmasi*.

## 4. Alarm
Di halaman perangkat → **Tambah alarm** (mis. `temperature` lebih dari 32).
Saat nilai melewati batas, pemilik dan manajer mendapat notifikasi (lonceng di aplikasi). Alarm otomatis selesai saat nilai kembali normal, dan tidak mengirim notifikasi berulang selama masih berlangsung.

## Kamera (foto berkala)
Perangkat yang sama (satu token) bisa mengirim foto: body = berkas gambar mentah (JPEG/PNG/WEBP, maks. 1,5 MB), minimal 5 detik antar foto.

```
curl -X POST {BASE_URL}/api/iot/v1/snapshots -H "Authorization: Bearer nt_dev_..." -H "Content-Type: image/jpeg" --data-binary @foto.jpg
```
Di Node-RED: node **http request** (POST, "Send body as: binary buffer") dengan header `Authorization`. ESP32-CAM: ambil `camera_fb_t`, lalu POST `fb->buf` sepanjang `fb->len` memakai `HTTPClient`. Jenis gambar ditentukan dari isi file, bukan header. Foto tampil di menu **Kamera kandang**; disimpan 100 foto terakhir atau 14 hari per kamera. Ini foto berkala, bukan video langsung; pengenalan gambar (mis. hitung ternak) belum ada.

## Node-RED
Impor `docs/nodered-flow.json` (menu ☰ → Import). Ganti alamat aplikasi dan token di node **Konfigurasi**, lalu ganti isi node fungsi dengan pembacaan sensor Anda.

## ESP32 (Arduino)
Lihat contoh di halaman perangkat (tab ESP32). Gunakan HTTPS bila aplikasi dipasang di internet publik.

## Catatan keamanan dan operasional
- Hanya hash SHA-256 token yang disimpan; token tidak bisa dilihat ulang.
- Perangkat hanya bisa menulis data ke perangkatnya sendiri. Perangkat nonaktif ditolak (`403`).
- Batas laju disimpan di memori proses. Untuk lebih dari satu instans server, pindahkan ke Redis.
- Data sensor menumpuk cepat (30 detik sekali = ±2.900 baris per metrik per hari). Rencanakan retensi/rollup (mis. hapus data mentah > 90 hari) sebelum dipakai skala besar.
- Belum ada: MQTT langsung, video langsung, dan penjadwalan otomatis perintah. Semuanya rencana lanjutan.
