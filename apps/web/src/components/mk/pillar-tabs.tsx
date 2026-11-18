"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "../icons";

const TABS: { id: string; label: string; icon: IconName; title: string; text: string; points: string[]; status: string }[] = [
  { id: "farm", label: "Smart Farm", icon: "farm", status: "Sudah bisa dipakai", title: "Catatan kandang rapi, tanpa ribet", text: "Gantikan buku tulis dan chat WhatsApp. Catat populasi, bobot, dan kematian dari HP, langsung dari kandang.", points: ["Catat bobot dan kematian dalam hitungan detik", "Populasi batch terhitung otomatis", "Tetap bisa dicatat saat sinyal hilang"] },
  { id: "sehat", label: "Kesehatan", icon: "heart", status: "Segera", title: "Penyakit ketahuan sebelum menyebar", text: "Jadwal vaksin dan riwayat pengobatan tersimpan rapi, jadi tidak ada lagi yang kelewat.", points: ["Pengingat jadwal vaksin", "Riwayat pengobatan per ekor atau batch", "Karantina dan biosekuriti"] },
  { id: "pasar", label: "Marketplace", icon: "cart", status: "Segera", title: "Jual beli lebih dekat dengan pasar", text: "Temukan pembeli, pakan, dan sarana dari vendor terverifikasi tanpa harus keliling.", points: ["Katalog ternak dan sarana", "Pesanan dan status pengiriman", "Ulasan untuk reputasi yang sehat"] },
  { id: "uang", label: "Keuangan", icon: "coin", status: "Segera", title: "Untung atau rugi? Langsung kelihatan", text: "Biaya pakan, obat, dan penjualan tercatat per batch, jadi hitungan untung-rugi tidak lagi tebak-tebakan.", points: ["Pemasukan dan pengeluaran", "Laba-rugi per batch", "Laporan siap bagikan"] },
  { id: "iot", label: "Smart Ternak (IoT)", icon: "cpu", status: "Segera", title: "Kandang yang bisa kasih kabar sendiri", text: "Sensor suhu, kelembapan, amonia, dan kualitas air mengirim peringatan sebelum masalah membesar.", points: ["Pantau suhu dan kelembapan kandang", "Sensor kolam: pH, oksigen, suhu", "Alarm otomatis lewat notifikasi"] },
  { id: "ai", label: "Smart Ternak (AI)", icon: "spark", status: "Segera", title: "Saran cerdas dari data kamu sendiri", text: "Makin lama dipakai, makin pintar. Prediksi bobot, perkiraan panen, dan rekomendasi pakan.", points: ["Prediksi waktu panen", "Deteksi dini kondisi tidak biasa", "Asisten tanya-jawab seputar ternak"] },
];

export function PillarTabs() {
  const [i, setI] = useState(0);
  const t = TABS[i]!;
  return (
    <div className="ptabs">
      <div className="ptabs-nav" role="tablist" aria-label="Pilar platform">
        {TABS.map((x, n) => (
          <button key={x.id} role="tab" aria-selected={n === i} className={n === i ? "on" : ""} onClick={() => setI(n)}>
            <span className="kpi-ic"><Icon name={x.icon} size={18} /></span>{x.label}
          </button>
        ))}
      </div>
      <div className="ptabs-panel glass-l" key={t.id} role="tabpanel">
        <div className="row between wrap"><span className="eyebrow"><Icon name={t.icon} size={16} /> {t.label}</span><span className={`badge dot ${t.status === "Segera" ? "" : "ok"}`}>{t.status}</span></div>
        <h3>{t.title}</h3>
        <p>{t.text}</p>
        <ul>{t.points.map((p) => <li key={p}><Icon name="check" size={18} /> {p}</li>)}</ul>
        <Link href="/produk" className="btn btn-secondary mt-1">Lihat detail <Icon name="arrowRight" size={16} /></Link>
      </div>
    </div>
  );
}
