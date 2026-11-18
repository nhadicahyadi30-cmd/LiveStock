import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Reveal, Spot } from "@/components/mk/fx";
import { PageHero } from "@/components/mk/page-hero";

export const metadata: Metadata = { title: "Layanan" };

const SERVICES: { icon: IconName; title: string; text: string }[] = [
  { icon: "farm", title: "Bantuan setup awal", text: "Kami bantu siapkan farm, kandang, dan batch pertama kamu, supaya mulai dari kondisi yang rapi dan nggak bingung di awal." },
  { icon: "download", title: "Pindah dari buku atau Excel", text: "Punya catatan lama? Kami bantu masukkan ke Nusa Ternak supaya riwayat usaha kamu nggak hilang." },
  { icon: "users", title: "Pelatihan tim kandang", text: "Latihan singkat dan praktis langsung di HP. Petugas biasanya cukup beberapa kali coba sampai lancar." },
  { icon: "chart", title: "Bantu baca dashboard", text: "Angka di layar bisa dibaca dengan berbagai cara. Kami bantu menerjemahkannya jadi langkah yang bisa dikerjakan." },
  { icon: "cpu", title: "Pemasangan sensor", text: "Untuk yang mau naik level: pemasangan sensor suhu, kelembapan, dan kualitas air, terhubung ke dashboard." },
  { icon: "shield", title: "Dukungan teknis", text: "Ada yang error atau bingung? Tim kami siap bantu supaya kerjaan di kandang nggak terhambat." },
];
const FOR: [string, string][] = [["Peternak perorangan", "Mulai dari satu atau dua kandang, tanpa harus belajar hal yang rumit."], ["Kelompok tani dan koperasi", "Banyak anggota, banyak farm, tapi data tetap bisa dilihat dalam satu tempat."], ["Usaha menengah", "Banyak petugas dan hak akses berlapis, lengkap dengan laporan dan jejak audit."]];
const FLOW = [["Kenalan", "Ceritakan kondisi usaha dan kebutuhan kamu."], ["Setup", "Kami siapkan farm, batch, dan akun tim."], ["Latihan", "Tim kandang dilatih pakai HP."], ["Jalan", "Mulai mencatat tiap hari."], ["Evaluasi", "Lihat hasilnya, lalu sesuaikan bareng."]];

export default function ServicesPage() {
  return (
    <>
      <PageHero eyebrow="Layanan" title={<>Kami nggak cuma kasih aplikasi. <span className="grad">Kami temani sampai bisa.</span></>}>
        Punya aplikasi bagus tapi nggak dipakai itu sia-sia. Makanya selain produk, kami siapkan layanan pendampingan supaya tim kamu benar-benar nyaman memakainya.
      </PageHero>
      <section className="sec"><div className="wrap-x">
        <div className="alert warn mb-3"><Icon name="info" /> Layanan pendampingan ini sedang kami siapkan. Daftar di bawah adalah rencana layanan yang akan tersedia bertahap.</div>
        <div className="grid g3">{SERVICES.map((s, i) => (<Reveal key={s.title} delay={(i % 3) * 80}><Spot className="card feat"><div className="kpi-ic"><Icon name={s.icon} size={22} /></div><h3>{s.title}</h3><p>{s.text}</p></Spot></Reveal>))}</div>
      </div></section>

      <section className="sec alt"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Untuk siapa</span><h2>Dari satu kandang sampai banyak farm</h2></div></Reveal>
        <div className="grid g3">{FOR.map(([t, d], i) => (<Reveal key={t} delay={i * 80}><div className="card card-pad"><h3 className="mb-1">{t}</h3><p className="muted">{d}</p></div></Reveal>))}</div>
      </div></section>

      <section className="sec"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Alur kerja sama</span><h2>Lima langkah dari kenalan sampai lancar</h2></div></Reveal>
        <div className="flow">{FLOW.map(([t, d], i) => (<Reveal key={t} delay={i * 90}><div className="flow-i"><span>{i + 1}</span><b>{t}</b><p className="sm muted">{d}</p></div></Reveal>))}</div>
        <div className="row mt-3 wrap"><Link href="/login" className="btn btn-primary btn-lg">Mulai dari aplikasinya</Link><Link href="/produk" className="btn btn-secondary btn-lg">Lihat produk</Link></div>
      </div></section>
    </>
  );
}
