import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Logo, TAGLINE } from "@/components/logo";
import { PILLARS } from "@/lib/modules";

const PILLAR_META: Record<string, { icon: IconName; text: string; tone: string }> = {
  "smart-farm": { icon: "farm", tone: "", text: "Catat populasi, bobot, kematian, pakan, dan produksi dari kandang. Tetap berjalan tanpa internet." },
  kesehatan: { icon: "heart", tone: "red", text: "Jadwal vaksin, riwayat pengobatan, dan karantina agar penyakit terdeteksi lebih awal." },
  marketplace: { icon: "cart", tone: "amber", text: "Jual beli ternak, pakan, dan sarana dengan vendor terverifikasi dalam satu tempat." },
  keuangan: { icon: "coin", tone: "blue", text: "Biaya, pendapatan, dan laba-rugi per batch supaya keputusan usaha berdasarkan angka." },
  "smart-ternak": { icon: "cpu", tone: "", text: "Sensor suhu, kelembapan, amonia, dan kualitas air terhubung dengan alarm otomatis." },
  ai: { icon: "spark", tone: "amber", text: "Prediksi bobot dan panen, deteksi dini anomali, serta rekomendasi pakan dari data Anda." },
};
const WHY: { icon: IconName; title: string; text: string }[] = [
  { icon: "wifiOff", title: "Offline-first", text: "Petugas tetap bisa mencatat di kandang tanpa sinyal. Data terkirim otomatis dan tidak pernah ganda." },
  { icon: "shield", title: "Data terpisah dan aman", text: "Data tiap organisasi dipisahkan di tingkat database, dengan jejak audit untuk setiap perubahan penting." },
  { icon: "users", title: "Peran dan akses jelas", text: "Pemilik, manajer, petugas, dan pengamat dengan hak yang sesuai. Akses bisa dibatasi per farm." },
  { icon: "chart", title: "Dashboard yang berguna", text: "Populasi, kematian, dan tren bobot dalam satu layar, siap dibawa ke rapat atau ke lapangan." },
];

export default function LandingPage() {
  return (
    <>
      <header className="mk-h"><div className="in">
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}><Logo /></Link>
        <nav className="mk-nav" aria-label="Menu"><a href="#pilar">Pilar platform</a><a href="#keunggulan">Keunggulan</a><a href="#peta">Peta pengembangan</a></nav>
        <div className="right row"><Link href="/login" className="btn btn-primary">Masuk</Link></div>
      </div></header>

      <section className="hero"><div className="wrap-x hero-grid">
        <div>
          <span className="eyebrow"><Icon name="spark" size={16} /> Platform peternakan terpadu</span>
          <h1>Ekosistem ternak cerdas untuk <em>Nusantara</em></h1>
          <p className="lead">Catat, pantau, dan kembangkan usaha ternak dalam satu platform. Dari kandang hingga pasar, dipakai langsung dari HP dan tetap berjalan saat sinyal hilang.</p>
          <div className="row wrap mt-3"><Link href="/login" className="btn btn-primary btn-lg">Masuk ke aplikasi <Icon name="arrowRight" size={18} /></Link><a href="#pilar" className="btn btn-secondary btn-lg">Lihat pilar platform</a></div>
          <div className="stats"><div><b>6 pilar</b><span>dalam satu ekosistem</span></div><div><b>Offline-first</b><span>aman di area minim sinyal</span></div><div><b>Multi-organisasi</b><span>data terpisah per usaha</span></div></div>
        </div>
        <div className="card mock" aria-hidden="true">
          <div className="mock-bar"><i /><i /><i /></div>
          <div className="mock-b">
            <div className="row between mb-2"><b>Dashboard</b><span className="badge info">Contoh tampilan</span></div>
            <div className="grid g2" style={{ gap: 12 }}>
              <div className="card kpi" style={{ padding: 14 }}><div className="kpi-top">Total populasi<span className="kpi-ic"><Icon name="layers" size={16} /></span></div><div className="kpi-v" style={{ fontSize: 24 }}>12.480</div></div>
              <div className="card kpi" style={{ padding: 14 }}><div className="kpi-top">Batch aktif<span className="kpi-ic blue"><Icon name="grid" size={16} /></span></div><div className="kpi-v" style={{ fontSize: 24 }}>8</div></div>
            </div>
            <div className="mt-2">
              {[["Broiler B-07", 4200, 100], ["Layer L-02", 3600, 86], ["Lele K-11", 2800, 67], ["Sapi S-03", 1880, 45]].map(([n, v, w]) => (
                <div className="hbar" key={String(n)}><span className="name">{n}</span><div className="progress"><i style={{ width: `${w}%` }} /></div><span className="val">{Number(v).toLocaleString("id-ID")}</span></div>))}
            </div>
          </div>
        </div>
      </div></section>

      <section className="sec" id="pilar"><div className="wrap-x">
        <div className="sec-h"><span className="eyebrow">Pilar platform</span><h2>Satu platform untuk seluruh rantai usaha ternak</h2><p>Mulai dari pencatatan harian, lalu tumbuh ke kesehatan, pasar, keuangan, sensor, dan kecerdasan buatan tanpa berpindah aplikasi.</p></div>
        <div className="grid g3">
          {PILLARS.filter((p) => PILLAR_META[p.id]).map((p) => { const m = PILLAR_META[p.id]!; return (
            <div className="card feat" key={p.id}><div className={`kpi-ic ${m.tone}`}><Icon name={m.icon} size={22} /></div><h3>{p.name}</h3><p>{m.text}</p></div>); })}
        </div>
      </div></section>

      <section className="sec alt" id="keunggulan"><div className="wrap-x">
        <div className="sec-h"><span className="eyebrow">Keunggulan</span><h2>Dibuat untuk kondisi lapangan yang nyata</h2><p>Peternakan tidak selalu punya sinyal kuat atau waktu untuk mengisi formulir panjang. Nusa Ternak dirancang untuk itu.</p></div>
        <div className="grid g4">{WHY.map((w) => (<div className="feat" key={w.title}><div className="kpi-ic" style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 14 }}><Icon name={w.icon} size={22} /></div><h3>{w.title}</h3><p>{w.text}</p></div>))}</div>
      </div></section>

      <section className="sec"><div className="wrap-x">
        <div className="sec-h"><span className="eyebrow">Cara mulai</span><h2>Tiga langkah menuju peternakan yang terukur</h2></div>
        <div className="grid g3 steps">
          {[["Buat farm dan batch", "Daftarkan lokasi dan kelompok ternak Anda beserta jumlah awal."], ["Catat setiap hari", "Petugas mencatat bobot dan kematian dalam hitungan detik, dari HP."], ["Pantau dan putuskan", "Lihat populasi dan tren di dashboard, lalu ambil keputusan berdasarkan data."]].map(([t, d]) => (
            <div className="card step" key={t}><h3 className="mb-1">{t}</h3><p className="muted">{d}</p></div>))}
        </div>
      </div></section>

      <section className="sec alt" id="peta"><div className="wrap-x">
        <div className="sec-h"><span className="eyebrow">Peta pengembangan</span><h2>Dikembangkan bertahap, terbuka soal progresnya</h2><p>Berikut modul yang sudah tersedia dan yang sedang direncanakan.</p></div>
        <div className="grid g3">
          {PILLARS.map((p) => { const d = p.modules.filter((m) => m.status === "done").length; return (
            <div className="card card-pad" key={p.id}><div className="row between mb-1"><b>{p.name}</b><span className="pill">{d}/{p.modules.length}</span></div><div className="progress"><i style={{ width: `${(d / p.modules.length) * 100}%` }} /></div><p className="xs muted mt-1">{d === 0 ? "Direncanakan" : d === p.modules.length ? "Lengkap" : "Sebagian tersedia"}</p></div>); })}
        </div>
      </div></section>

      <section className="sec"><div className="wrap-x"><div className="cta">
        <h2>Siap mengelola peternakan dengan lebih cerdas?</h2><p>{TAGLINE}.</p>
        <Link href="/login" className="btn btn-lg btn-light">Masuk ke aplikasi <Icon name="arrowRight" size={18} /></Link>
      </div></div></section>

      <footer className="mk-f"><div className="wrap-x">
        <div className="cols">
          <div><Logo tagline /></div>
          <div><h4>Platform</h4><ul><li><a href="#pilar">Pilar platform</a></li><li><a href="#keunggulan">Keunggulan</a></li><li><a href="#peta">Peta pengembangan</a></li></ul></div>
          <div><h4>Akun</h4><ul><li><Link href="/login">Masuk</Link></li></ul></div>
          <div><h4>Proyek</h4><ul><li><a href="https://github.com/nhadicahyadi30-cmd/LiveStock">Kode sumber</a></li></ul></div>
        </div>
        <p className="xs muted mt-3">© {new Date().getFullYear()} Nusa Ternak. Versi pengembangan.</p>
      </div></footer>
    </>
  );
}
