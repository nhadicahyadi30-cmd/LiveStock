# Nusa Ternak

*Ekosistem Ternak Cerdas untuk Nusantara.* Logo: `apps/web/public/logo*.svg`. Daftar modul dan tahap pengerjaan: [docs/MODUL.md](docs/MODUL.md). Menyambungkan perangkat kandang: [docs/IOT.md](docs/IOT.md).

Kerangka proyek untuk MVP (pilar Smart Farm): monorepo pnpm, Next.js, PostgreSQL + Prisma, isolasi tenant
dengan RLS, matriks izin, dan CI. Mengikuti dokumen *Spesifikasi Sistem & UI/UX MVP* dan *Desain Database MVP*.

## Status

Kerangka ini ditulis tanpa akses jaringan, jadi paket belum dipasang dan **belum pernah dijalankan end-to-end**.

| Bagian | Sudah diuji? |
| --- | --- |
| `prisma/sql/001-003` (RLS, grant, CHECK, view, trigger) | Ya, di PostgreSQL 16: diterapkan dua kali (idempoten) dan 9 skenario perilaku lulus sebagai `app_user` |
| `docker/postgres/init.sql` | Ya, di PostgreSQL 16 |
| `schema.prisma`, kode TypeScript, uji Vitest, CI | Belum. Jalankan `pnpm --filter @sl/database validate` dan `pnpm typecheck` lebih dulu |

Titik yang paling mungkin perlu perbaikan kecil: `schema.prisma` memakai foreign key gabungan
`(organization_id, id)` dan beberapa relasi berbagi kolom `organization_id` (`MembershipFarm`). Bila `prisma validate`
mengeluh, ganti relasi itu menjadi FK tunggal; RLS tetap menjaga isolasi tenant.

## Prasyarat

- Node.js 20 atau lebih baru (disarankan 22), pnpm 9
- Docker (untuk PostgreSQL 16 lokal)

## Mulai cepat

```bash
cp .env.example .env
cp .env.example apps/web/.env.local
pnpm install
pnpm db:up                 # PostgreSQL 16 + role migrator dan app_user
pnpm db:setup              # generate client, db push, RLS/constraints, seed species
SEED_DEMO=true pnpm db:seed   # opsional: organisasi dan farm demo

> Setelah `git pull` yang menambah tabel baru (mis. pakan, produksi, tugas), jalankan ulang `pnpm db:setup` agar skema dan file SQL terbaru diterapkan.
pnpm dev                   # http://localhost:3000
```

Antarmuka: buka http://localhost:3000, masuk dengan akun demo (`demo@example.test` / `demo12345`, dibuat oleh
`SEED_DEMO=true pnpm db:seed`). Isi `SESSION_SECRET` di `.env.local` (minimal 32 karakter, `openssl rand -base64 48`).
Halaman publik: `/` (beranda), `/produk`, `/layanan`, `/tentang`, dan `/login`. Aplikasi di `/app`: Dashboard, Catat (bobot dan kematian, dengan antrean offline), Ternak (tabel batch dan individual, detail batch), dan Peta modul. Tersedia mode gelap dan tampilan HP.

### Data dummy lengkap (banyak pengguna, semua fitur)

```bash
pnpm db:seed:demo
```

Membuat 9 akun dan 5 organisasi (sapi/kambing, ayam, ikan, toko pakan, dokter hewan) lengkap dengan ternak, bobot,
pakan, produksi, kesehatan terjadwal, keuangan, IoT + alarm, kamera, pesanan marketplace (berbagai status),
konsultasi dokter, pembiayaan, langganan, kunci API, dan webhook. Kata sandi semua akun `demo12345`
(`budi@demo.test`, `ani@demo.test`, `dedi@demo.test`, `toko@demo.test`, `rina@demo.test`, dll.).
Foto contoh produk marketplace: `pnpm db:seed:photos` (aman diulang). Skrip berhenti bila datanya sudah ada; untuk mengulang dari nol jalankan `pnpm db:push --force-reset`, `pnpm db:setup`, lalu `pnpm db:seed:demo`.


Mencoba API dengan sesi pengembangan (hanya aktif bila `ENABLE_DEV_SESSION=true` dan bukan production):

```bash
curl localhost:3000/api/v1/health

curl localhost:3000/api/v1/farms \
  -H "x-dev-user-id: 0192f0a0-0000-7000-8000-00000000d001" \
  -H "x-dev-organization-id: 0192f0a0-0000-7000-8000-00000000d002"
```

Uji (gunakan database uji terpisah; uji tenant isolation menulis data):

```bash
pnpm test        # permissions, validation, dan tenant isolation (butuh DB + pnpm db:rls + pnpm db:seed)
pnpm typecheck
```

## Struktur

```
apps/web/                 Next.js 15 (App Router): UI dan API /api/v1
  src/server/             errors, session, tenant-guard, audit, pagination
  src/app/api/v1/         health, me, farms (contoh endpoint bertenant)
packages/database/        schema.prisma, withTenant/withUser, SQL RLS, seed, uji isolasi tenant
  prisma/sql/             001_rls, 002_grants, 003_constraints (dijalankan oleh pnpm db:rls)
packages/permissions/     matriks role dan izin, canEditRecord (jendela 24 jam petugas)
packages/validation/      skema Zod request (tanpa organization_id)
docker/postgres/init.sql  role migrator dan app_user
.github/workflows/ci.yml  PostgreSQL, db push, RLS, seed, typecheck, test
```

## Cara kerja isolasi tenant

1. Aplikasi terhubung sebagai `app_user` (bukan superuser, tanpa `BYPASSRLS`). Migrasi memakai `migrator`.
2. Setiap endpoint bertenant dibungkus `tenantRoute({ permission })` di `apps/web/src/server/tenant-guard.ts`:
   sesi valid, organisasi aktif ada, pengguna anggota aktif (dicek ke database), role punya izin, lalu handler
   berjalan di `withTenant()`.
3. `withTenant()` membuka transaksi dan menjalankan `set_config('app.organization_id', ..., true)`. Nilainya lokal
   transaksi, jadi aman dengan connection pooling dan tidak bocor ke request lain.
4. Kebijakan RLS di setiap tabel ber-`organization_id` membandingkan baris dengan konteks itu. Tanpa konteks,
   query mengembalikan nol baris (gagal tertutup).
5. `organization_id` tidak pernah dibaca dari body atau query request; skema Zod tidak memilikinya.

Menambah endpoint baru:

```ts
export const POST = tenantRoute({ permission: "records.create" }, async (c) => {
  const input = weightRecordCreate.parse(await c.req.json());
  const rec = await c.tx.weightRecord.create({
    data: { ...input, organizationId: c.organizationId, recordedBy: c.userId },
  });
  return Response.json({ data: rec }, { status: 201 });
});
```

Menambah tabel bertenant baru: beri kolom `organization_id`, jalankan `pnpm db:rls`. Kebijakan RLS dipasang otomatis
ke semua tabel yang punya kolom itu. Tambahkan nama tabel ke uji isolasi tenant.

## Migrasi

Saat ini `pnpm db:push` dipakai (lokal dan CI) agar cepat bergerak. Sebelum data nyata ada, beralih ke migrasi:

1. `pnpm db:migrate --name init` membuat migrasi tabel.
2. `pnpm db:migrate --create-only --name rls_constraints`, lalu tempel isi `prisma/sql/001..003` ke `migration.sql`.
   Urutan harus setelah `init`.
3. Ganti `db:push` dan `db:rls` di CI dan deployment dengan `prisma migrate deploy`.
4. Commit `pnpm-lock.yaml` dan ubah CI ke `pnpm install --frozen-lockfile`.

Butuh PostgreSQL 15 atau lebih baru (`security_invoker` pada view).

## Yang masih terbuka

- **Login.** Sementara memakai email + kata sandi (scrypt) dan cookie sesi bertanda tangan HMAC tanpa library tambahan
  (`session-token.ts`, `/api/v1/auth/*`). Belum ada: pembatasan percobaan login, registrasi, reset kata sandi,
  verifikasi email, dan pencabutan sesi per perangkat. Tabel `users` masih tanpa RLS dan dibaca langsung saat login;
  aktifkan RLS dan buat fungsi `SECURITY DEFINER` untuk pencarian email (lihat TODO di `001_rls.sql`).
  Bila nanti pindah ke Auth.js atau penyedia terkelola, cukup ganti `SessionProvider`.
- **Offline.** Antrean memakai localStorage (`lib/offline-queue.ts`) dan hanya terkirim saat aplikasi terbuka.
  Service worker, IndexedDB, dan ikon PWA belum ada. Gaya memakai design system CSS sendiri (`apps/web/src/app/globals.css`) dan ikon SVG sendiri, tanpa Tailwind/shadcn.
- **`ENABLE_DEV_SESSION` wajib mati** di staging dan production. Guard menolaknya bila `NODE_ENV=production`,
  tetapi jangan bergantung pada itu saja.
- **Model Prisma yang belum ada:** pakan, produksi, kesehatan, tugas, perpindahan, lampiran, laporan, notifikasi,
  undangan, breeds, farm_sites. Kolomnya ada di dokumen Desain Database.
- **Foreign key gabungan** baru dipasang untuk farm, batch, dan batch_events. Relasi ke ternak, batch, dan fasilitas
  pada tabel catatan masih kolom biasa; integritasnya dijaga CHECK dan RLS.
- **Galat trigger populasi** (kode `23514`) saat ini menjadi 500 di API; petakan ke 422 saat endpoint mortalitas dibuat.
- **UI, Tailwind/shadcn, PWA offline, worker laporan:** belum dimulai; mengikuti urutan roadmap fase 2.
- Penyedia database terkelola dan wilayahnya, serta kebijakan retensi data, belum diputuskan.
