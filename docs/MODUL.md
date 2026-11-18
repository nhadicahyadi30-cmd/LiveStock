# Daftar modul Nusa Ternak

Sumber data: `apps/web/src/lib/modules.ts` (juga tampil di halaman **Modul** di aplikasi).

## Tahap pengerjaan

1. **Smart Farm lengkap (MVP)**: pakan, produksi, perpindahan, tugas, notifikasi, anggota, laporan, dashboard, PWA.
2. **Kesehatan ternak**: vaksin, pengobatan, karantina, konsultasi.
3. **Marketplace multi-vendor.**
4. **Keuangan.**
5. **Smart Ternak (IoT).**
6. **Smart Ternak (AI).**

Tahap 3 sampai 6 bergantung pada keputusan dan data dari luar (penyedia pembayaran, perangkat IoT, mitra keuangan, data riil untuk AI).

## Platform & Akun

Fondasi yang dipakai semua pilar.

- [x] Multi-organisasi dan isolasi data (RLS) (Selesai): Data tiap organisasi terpisah di level database.
- [x] Login dan sesi (Selesai): Email + kata sandi, cookie bertanda tangan.
- [x] Role dan hak akses (Selesai): Owner, Manajer, Petugas, Pengamat.
- [x] Audit log (Selesai): Jejak aksi penting, tidak bisa diubah.
- [~] Registrasi, reset kata sandi, verifikasi email (Tahap 1)
- [~] Anggota dan undangan (Tahap 1): Undang tim, atur role dan akses per farm.
- [ ] Paket langganan dan penagihan (Tahap 4)
- [ ] API terbuka dan webhook (Tahap 6)

## Smart Farm (MVP)

Pencatatan dan pengelolaan peternakan harian.

- [~] Farm dan fasilitas (kandang, kolam) (Tahap 1): Farm sudah ada; fasilitas menyusul.
- [x] Ternak individual dan batch (Selesai): Daftar, populasi dihitung otomatis.
- [x] Bobot dan pertumbuhan (Selesai): Catat bobot; grafik ADG menyusul.
- [x] Kematian (mortalitas) (Selesai): Per ekor atau per batch, bisa dibatalkan.
- [~] Pakan dan FCR (Tahap 1): Stok pakan, pemberian, konversi pakan.
- [~] Produksi (telur, susu, panen) (Tahap 1)
- [~] Perpindahan dan penjualan ternak (Tahap 1): Mutasi antar kandang, jual, afkir.
- [~] Tugas harian dan pengingat (Tahap 1)
- [~] Notifikasi (Tahap 1)
- [~] Dashboard dan laporan (PDF/Excel) (Tahap 1): Wireframe dashboard ada di dokumen spesifikasi.
- [~] PWA dan mode offline penuh (Tahap 1): Antrean offline dasar sudah ada.

## Kesehatan Ternak

Vaksin, pengobatan, dan pencegahan penyakit.

- [~] Jadwal dan catatan vaksinasi (Tahap 2)
- [~] Pengobatan dan rekam medis (Tahap 2)
- [~] Karantina dan biosekuriti (Tahap 2)
- [ ] Konsultasi dokter hewan (Tahap 2)

## Marketplace

Jual beli ternak, pakan, dan sarana multi-vendor.

- [~] Profil vendor dan verifikasi (Tahap 3)
- [~] Katalog produk dan stok (Tahap 3)
- [~] Keranjang, pesanan, dan status (Tahap 3)
- [ ] Pembayaran dan rekening bersama (escrow) (Tahap 3): Butuh keputusan penyedia pembayaran.
- [ ] Pengiriman dan logistik (Tahap 3)
- [~] Ulasan dan reputasi (Tahap 3)
- [ ] Harga pasar (Tahap 3)

## Keuangan

Biaya, pendapatan, dan kelayakan usaha.

- [ ] Pencatatan pemasukan dan pengeluaran (Tahap 4)
- [ ] HPP dan laba-rugi per batch (Tahap 4)
- [ ] Anggaran dan arus kas (Tahap 4)
- [ ] Invoice dan piutang (Tahap 4)
- [ ] Akses pembiayaan dan mitra (Tahap 4): Butuh mitra keuangan.

## Smart Ternak (IoT)

Sensor dan otomasi kandang dan kolam.

- [ ] Manajemen perangkat dan gateway (Tahap 5): Butuh keputusan perangkat dan protokol.
- [ ] Sensor kandang: suhu, kelembapan, amonia (Tahap 5)
- [ ] Sensor kolam: pH, oksigen, suhu, salinitas (Tahap 5)
- [ ] Alarm dan ambang batas otomatis (Tahap 5)
- [ ] Pakan dan minum otomatis (Tahap 5)
- [ ] Kamera dan pemantauan visual (Tahap 5)
- [ ] Grafik sensor waktu nyata (Tahap 5)

## Smart Ternak (AI)

Prediksi dan rekomendasi dari data peternakan.

- [ ] Prediksi bobot dan waktu panen (Tahap 6): Butuh data riil beberapa siklus.
- [ ] Deteksi dini penyakit dan anomali (Tahap 6)
- [ ] Rekomendasi pakan dan FCR (Tahap 6)
- [ ] Prediksi harga pasar (Tahap 6)
- [ ] Asisten tanya-jawab peternakan (Tahap 6)

Keterangan: `[x]` tersedia, `[~]` sebagian, `[ ]` direncanakan.
