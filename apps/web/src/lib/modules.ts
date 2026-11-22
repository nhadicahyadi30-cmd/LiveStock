// Daftar modul Nusa Ternak: satu sumber untuk halaman /modul dan docs/MODUL.md.
// Ubah status di sini setiap modul selesai (planned -> progress -> done).
// phase: 0 = sudah ada, 1..6 = tahap pengerjaan (lihat docs/MODUL.md).
export type ModuleStatus = "done" | "progress" | "planned";

export interface ModuleItem {
  name: string;
  status: ModuleStatus;
  phase: number;
  note: string;
}
export interface Pillar {
  id: string;
  name: string;
  description: string;
  modules: ModuleItem[];
}

export const PILLARS: Pillar[] = [
  {
    "id": "platform",
    "name": "Platform & Akun",
    "description": "Fondasi yang dipakai semua pilar.",
    "modules": [
      {
        "name": "Multi-organisasi dan isolasi data (RLS)",
        "status": "done",
        "phase": 0,
        "note": "Data tiap organisasi terpisah di level database."
      },
      {
        "name": "Login dan sesi",
        "status": "done",
        "phase": 0,
        "note": "Email + kata sandi, cookie bertanda tangan."
      },
      {
        "name": "Role dan hak akses",
        "status": "done",
        "phase": 0,
        "note": "Owner, Manajer, Petugas, Pengamat."
      },
      {
        "name": "Audit log",
        "status": "done",
        "phase": 0,
        "note": "Jejak aksi penting, tidak bisa diubah."
      },
      {
        "name": "Registrasi, reset kata sandi, verifikasi email",
        "status": "progress",
        "phase": 1,
        "note": ""
      },
      {
        "name": "Anggota dan undangan",
        "status": "progress",
        "phase": 1,
        "note": "Undang tim, atur role dan akses per farm."
      },
      {
        "name": "Paket langganan dan penagihan",
        "status": "progress",
        "phase": 4,
        "note": ""
      },
      {
        "name": "API terbuka dan webhook",
        "status": "progress",
        "phase": 6,
        "note": ""
      }
    ]
  },
  {
    "id": "smart-farm",
    "name": "Smart Farm (MVP)",
    "description": "Pencatatan dan pengelolaan peternakan harian.",
    "modules": [
      {
        "name": "Farm dan fasilitas (kandang, kolam)",
        "status": "progress",
        "phase": 1,
        "note": "Farm sudah ada; fasilitas menyusul."
      },
      {
        "name": "Ternak individual dan batch",
        "status": "done",
        "phase": 0,
        "note": "Daftar, populasi dihitung otomatis."
      },
      {
        "name": "Bobot dan pertumbuhan",
        "status": "done",
        "phase": 0,
        "note": "Catat bobot; grafik ADG menyusul."
      },
      {
        "name": "Kematian (mortalitas)",
        "status": "done",
        "phase": 0,
        "note": "Per ekor atau per batch, bisa dibatalkan."
      },
      {
        "name": "Pakan dan FCR",
        "status": "progress",
        "phase": 1,
        "note": "Stok pakan, pemberian, konversi pakan."
      },
      {
        "name": "Produksi (telur, susu, panen)",
        "status": "progress",
        "phase": 1,
        "note": ""
      },
      {
        "name": "Perpindahan dan penjualan ternak",
        "status": "progress",
        "phase": 1,
        "note": "Mutasi antar kandang, jual, afkir."
      },
      {
        "name": "Tugas harian dan pengingat",
        "status": "progress",
        "phase": 1,
        "note": ""
      },
      {
        "name": "Notifikasi",
        "status": "progress",
        "phase": 1,
        "note": ""
      },
      {
        "name": "Dashboard dan laporan (PDF/Excel)",
        "status": "progress",
        "phase": 1,
        "note": "Wireframe dashboard ada di dokumen spesifikasi."
      },
      {
        "name": "PWA dan mode offline penuh",
        "status": "progress",
        "phase": 1,
        "note": "Antrean offline dasar sudah ada."
      }
    ]
  },
  {
    "id": "kesehatan",
    "name": "Kesehatan Ternak",
    "description": "Vaksin, pengobatan, dan pencegahan penyakit.",
    "modules": [
      {
        "name": "Jadwal dan catatan vaksinasi",
        "status": "progress",
        "phase": 2,
        "note": ""
      },
      {
        "name": "Pengobatan dan rekam medis",
        "status": "progress",
        "phase": 2,
        "note": ""
      },
      {
        "name": "Karantina dan biosekuriti",
        "status": "progress",
        "phase": 2,
        "note": ""
      },
      {
        "name": "Konsultasi dokter hewan",
        "status": "progress",
        "phase": 2,
        "note": ""
      }
    ]
  },
  {
    "id": "marketplace",
    "name": "Marketplace",
    "description": "Jual beli ternak, pakan, dan sarana multi-vendor.",
    "modules": [
      {
        "name": "Profil vendor dan verifikasi",
        "status": "progress",
        "phase": 3,
        "note": ""
      },
      {
        "name": "Katalog produk dan stok",
        "status": "progress",
        "phase": 3,
        "note": ""
      },
      {
        "name": "Keranjang, pesanan, dan status",
        "status": "progress",
        "phase": 3,
        "note": ""
      },
      {
        "name": "Pembayaran dan rekening bersama (escrow)",
        "status": "progress",
        "phase": 3,
        "note": "Mode manual: pencatatan, konfirmasi penjual, sengketa. Penahanan dana sungguhan butuh penyedia pembayaran."
      },
      {
        "name": "Pengiriman dan logistik",
        "status": "progress",
        "phase": 3,
        "note": ""
      },
      {
        "name": "Ulasan dan reputasi",
        "status": "progress",
        "phase": 3,
        "note": ""
      },
      {
        "name": "Harga pasar",
        "status": "progress",
        "phase": 3,
        "note": ""
      }
    ]
  },
  {
    "id": "keuangan",
    "name": "Keuangan",
    "description": "Biaya, pendapatan, dan kelayakan usaha.",
    "modules": [
      {
        "name": "Pencatatan pemasukan dan pengeluaran",
        "status": "progress",
        "phase": 4,
        "note": ""
      },
      {
        "name": "HPP dan laba-rugi per batch",
        "status": "progress",
        "phase": 4,
        "note": ""
      },
      {
        "name": "Anggaran dan arus kas",
        "status": "progress",
        "phase": 4,
        "note": ""
      },
      {
        "name": "Invoice dan piutang",
        "status": "progress",
        "phase": 4,
        "note": ""
      },
      {
        "name": "Akses pembiayaan dan mitra",
        "status": "progress",
        "phase": 4,
        "note": "Mekanisme siap (pengajuan, ringkasan keuangan). Mitra ditambahkan operator."
      }
    ]
  },
  {
    "id": "smart-ternak",
    "name": "Smart Ternak (IoT)",
    "description": "Sensor dan otomasi kandang dan kolam.",
    "modules": [
      {
        "name": "Manajemen perangkat dan gateway",
        "status": "progress",
        "phase": 5,
        "note": "Lewat HTTP dan Node-RED, lihat docs/IOT.md. MQTT menyusul."
      },
      {
        "name": "Sensor kandang: suhu, kelembapan, amonia",
        "status": "progress",
        "phase": 5,
        "note": ""
      },
      {
        "name": "Sensor kolam: pH, oksigen, suhu, salinitas",
        "status": "progress",
        "phase": 5,
        "note": ""
      },
      {
        "name": "Alarm dan ambang batas otomatis",
        "status": "progress",
        "phase": 5,
        "note": ""
      },
      {
        "name": "Pakan dan minum otomatis",
        "status": "progress",
        "phase": 5,
        "note": ""
      },
      {
        "name": "Kamera dan pemantauan visual",
        "status": "progress",
        "phase": 5,
        "note": ""
      },
      {
        "name": "Grafik sensor waktu nyata",
        "status": "progress",
        "phase": 5,
        "note": ""
      }
    ]
  },
  {
    "id": "ai",
    "name": "Smart Ternak (AI)",
    "description": "Prediksi dan rekomendasi dari data peternakan.",
    "modules": [
      {
        "name": "Prediksi bobot dan waktu panen",
        "status": "progress",
        "phase": 6,
        "note": "Garis tren statistik dari catatan bobot; makin rutin makin akurat."
      },
      {
        "name": "Deteksi dini penyakit dan anomali",
        "status": "progress",
        "phase": 6,
        "note": "Lonjakan kematian, pakan turun, bobot turun, sensor menyimpang. Berbasis aturan statistik."
      },
      {
        "name": "Rekomendasi pakan dan FCR",
        "status": "progress",
        "phase": 6,
        "note": "FCR per batch dan perbandingan antarbatch usaha sendiri."
      },
      {
        "name": "Prediksi harga pasar",
        "status": "progress",
        "phase": 6,
        "note": ""
      },
      {
        "name": "Asisten tanya-jawab peternakan",
        "status": "progress",
        "phase": 6,
        "note": ""
      }
    ]
  }
];

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  done: "Tersedia",
  progress: "Dikerjakan",
  planned: "Direncanakan",
};
