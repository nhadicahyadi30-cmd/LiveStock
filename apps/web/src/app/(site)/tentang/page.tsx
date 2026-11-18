import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Reveal, Spot } from "@/components/mk/fx";
import { PageHero } from "@/components/mk/page-hero";

export const metadata: Metadata = { title: "Tentang kami" };

const VALUES: { icon: IconName; title: string; text: string }[] = [
  { icon: "check", title: "Sederhana dulu", text: "Kalau petugas di kandang nggak bisa langsung paham, berarti fiturnya belum selesai." },
  { icon: "shield", title: "Data milik peternak", text: "Data usaha kamu adalah milik kamu. Kami jaga, bukan jual." },
  { icon: "wifiOff", title: "Sesuai kondisi lapangan", text: "Sinyal tidak selalu ada, jadi aplikasi harus tetap berguna tanpa itu." },
  { icon: "users", title: "Tumbuh bareng", text: "Fitur kami urutkan berdasarkan kebutuhan peternak, bukan keinginan kami sendiri." },
];
const ROAD = [["Tahap 1", "Smart Farm lengkap", "Pakan, produksi, tugas, notifikasi, laporan, dan dashboard."], ["Tahap 2", "Kesehatan ternak", "Vaksin, pengobatan, dan karantina."], ["Tahap 3", "Marketplace", "Jual beli dengan vendor terverifikasi."], ["Tahap 4", "Keuangan", "Biaya, pendapatan, dan laba-rugi."], ["Tahap 5", "Smart Ternak (IoT)", "Sensor kandang dan kolam."], ["Tahap 6", "Smart Ternak (AI)", "Prediksi dan rekomendasi."]];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="Tentang kami" title={<>Teknologi yang <span className="grad">ngerti kandang,</span> bukan cuma ngerti layar.</>}>
        Nusa Ternak adalah platform digital untuk peternakan dan agribisnis di Indonesia. Kami ingin urusan ternak jadi lebih ringan, lebih terukur, dan lebih menguntungkan.
      </PageHero>

      <section className="sec"><div className="wrap-x grid g2" style={{ alignItems: "center", gap: 40 }}>
        <Reveal><div><span className="eyebrow">Kenapa kami ada</span><h2 style={{ fontSize: 32, margin: "12px 0" }}>Karena banyak kerja keras di kandang belum terukur</h2>
          <p className="muted mb-2" style={{ fontSize: 17 }}>Peternak bekerja tiap hari, tapi banyak yang masih mencatat manual dan sulit melihat gambaran besar usahanya. Akibatnya, masalah sering baru ketahuan setelah terlambat.</p>
          <p className="muted" style={{ fontSize: 17 }}>Nusa Ternak dibuat untuk mengubah itu: dari pencatatan harian yang gampang, sampai ekosistem yang menghubungkan kesehatan, pasar, keuangan, sensor, dan kecerdasan buatan.</p></div></Reveal>
        <Reveal delay={120}><div className="grid g2">
          <div className="card card-pad"><span className="eyebrow">Visi</span><p className="mt-1">Menjadi ekosistem peternakan cerdas yang membantu peternak di seluruh Nusantara tumbuh dan sejahtera.</p></div>
          <div className="card card-pad"><span className="eyebrow">Misi</span><p className="mt-1">Menyediakan alat yang mudah dipakai, tetap berguna di area minim sinyal, dan mengubah catatan harian menjadi keputusan yang tepat.</p></div>
        </div></Reveal>
      </div></section>

      <section className="sec alt"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Nilai kami</span><h2>Pegangan kami saat membangun</h2></div></Reveal>
        <div className="grid g4">{VALUES.map((v, i) => (<Reveal key={v.title} delay={i * 80}><Spot className="card feat"><div className="kpi-ic"><Icon name={v.icon} size={22} /></div><h3>{v.title}</h3><p>{v.text}</p></Spot></Reveal>))}</div>
      </div></section>

      <section className="sec"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Arah ke depan</span><h2>Dibangun bertahap, dari yang paling dibutuhkan</h2><p>Urutan ini bisa menyesuaikan masukan dari peternak yang memakainya.</p></div></Reveal>
        <div className="timeline">{ROAD.map(([a, b, c], i) => (<Reveal key={a} delay={i * 70}><div className="tl-i"><span className="tl-dot" /><div><div className="xs muted" style={{ fontWeight: 700 }}>{a}</div><b>{b}</b><p className="sm muted">{c}</p></div></div></Reveal>))}</div>
        <div className="row mt-3 wrap"><Link href="/login" className="btn btn-primary btn-lg">Coba sekarang</Link><Link href="/produk" className="btn btn-secondary btn-lg">Lihat produk</Link></div>
      </div></section>
    </>
  );
}
