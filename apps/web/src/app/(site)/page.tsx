import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/logo";
import { LossCalculator } from "@/components/mk/calculator";
import { CountUp, Reveal, Rotator, Spot } from "@/components/mk/fx";
import { HeroMock } from "@/components/mk/hero-mock";
import { PillarTabs } from "@/components/mk/pillar-tabs";
import { PILLARS } from "@/lib/modules";

const SPECIES = ["Sapi", "Kambing", "Domba", "Ayam broiler", "Ayam layer", "Bebek", "Babi", "Kelinci", "Ikan", "Udang"];
const PAIN: { icon: IconName; title: string; text: string }[] = [
  { icon: "edit", title: "Catatan tercecer", text: "Sebagian di buku, sebagian di chat, sebagian lagi cuma di kepala. Pas dicari, nggak ketemu." },
  { icon: "skull", title: "Ketahuan pas sudah telat", text: "Ternak mati pelan-pelan dan baru terasa setelah jumlahnya banyak. Penyebabnya pun susah dilacak." },
  { icon: "coin", title: "Untung-rugi serba kira-kira", text: "Habis panen, bingung sebenarnya untung berapa. Biaya pakan dan obat nggak pernah terhitung rapi." },
  { icon: "wifiOff", title: "Sinyal susah di kandang", text: "Aplikasi lain butuh internet terus. Padahal kandang sering di tempat yang sinyalnya hilang-timbul." },
];
const WHY: { icon: IconName; title: string; text: string }[] = [
  { icon: "wifiOff", title: "Tanpa sinyal, tetap jalan", text: "Catat dulu, kirim belakangan. Begitu internet balik, datanya masuk sendiri dan nggak akan dobel." },
  { icon: "shield", title: "Data aman dan terpisah", text: "Data tiap usaha dipisah ketat. Perubahan penting juga tercatat jejaknya, jadi gampang ditelusuri." },
  { icon: "users", title: "Satu tim, hak akses beda", text: "Pemilik, manajer, petugas, sampai pengamat punya akses yang pas. Bisa dibatasi per farm." },
  { icon: "chart", title: "Dashboard yang enak dilihat", text: "Populasi, kematian, dan tren bobot muncul dalam satu layar. Cukup sekali lirik, langsung paham." },
];
const FAQ = [
  ["Harus selalu online?", "Nggak. Pencatatan bobot dan kematian bisa dilakukan tanpa internet. Datanya disimpan di HP dulu, lalu terkirim otomatis begitu sinyal kembali."],
  ["Cocok untuk ternak apa saja?", "Saat ini sudah disiapkan untuk sapi, kambing, domba, ayam (broiler dan layer), bebek, babi, kelinci, ikan, dan udang."],
  ["Bisa dipakai ramai-ramai satu tim?", "Bisa. Satu usaha bisa punya beberapa orang dengan peran berbeda, dan akses tiap orang bisa dibatasi per farm."],
  ["Data saya aman?", "Data tiap organisasi dipisahkan di level database, dan perubahan penting dicatat di jejak audit yang tidak bisa diubah."],
  ["Berapa biayanya?", "Nusa Ternak masih dalam tahap pengembangan, jadi paket dan harga belum ditetapkan. Kabar terbarunya akan kami umumkan di sini."],
  ["Fitur lain kapan jadi?", "Kami kerjakan bertahap dan terbuka soal progresnya. Cek bagian peta pengembangan di bawah untuk melihat mana yang sudah jadi."],
];

export default function HomePage() {
  return (
    <>
      <section className="hero-dark"><div className="aurora" aria-hidden="true" /><div className="gridbg" aria-hidden="true" />
        <div className="wrap-x hero-grid" style={{ position: "relative" }}>
          <div>
            <span className="eyebrow dark"><Icon name="spark" size={16} /> Untuk peternak <b style={{ minWidth: 76, display: "inline-block" }}><Rotator words={["ayam", "sapi", "kambing", "ikan", "bebek", "udang"]} /></b></span>
            <h1>Urus ternak makin gampang. <span className="grad">Untung makin jelas.</span></h1>
            <p className="lead">Nusa Ternak bantu kamu mencatat, memantau, dan mengambil keputusan dari satu aplikasi. Mulai dari kandang sampai ke pasar. Sinyal hilang? Tenang, tetap bisa jalan.</p>
            <div className="row wrap mt-3"><Link href="/login" className="btn btn-primary btn-lg glow">Coba sekarang <Icon name="arrowRight" size={18} /></Link><a href="#cara" className="btn btn-lg btn-outline-light">Lihat caranya</a></div>
            <div className="stats dark">
              <div><b><CountUp to={10} /></b><span>jenis ternak didukung</span></div>
              <div><b><CountUp to={6} /></b><span>pilar dalam satu aplikasi</span></div>
              <div><b>Offline</b><span>tetap bisa mencatat</span></div>
            </div>
          </div>
          <HeroMock />
        </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="track">{[...SPECIES, ...SPECIES].map((s, i) => <span key={i}>{s}</span>)}</div></div>

      <section className="sec"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Kenal nggak sama ini?</span><h2>Urus ternak itu capek. Apalagi kalau catatannya berantakan.</h2><p>Banyak peternak sudah kerja keras tiap hari, tapi tetap kebingungan karena data nggak terkumpul rapi. Beberapa hal ini mungkin terasa akrab.</p></div></Reveal>
        <div className="grid g4">{PAIN.map((p, i) => (<Reveal key={p.title} delay={i * 80}><Spot className="card feat"><div className="kpi-ic red"><Icon name={p.icon} size={22} /></div><h3>{p.title}</h3><p>{p.text}</p></Spot></Reveal>))}</div>
      </div></section>

      <section className="sec alt"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Jawabannya</span><h2>Satu aplikasi, enam pilar. Tumbuh bareng usaha kamu.</h2><p>Mulai dari yang paling dibutuhkan, yaitu catatan harian. Setelah itu, tambah kesehatan, pasar, keuangan, sensor, dan AI tanpa pindah aplikasi. Klik tiap pilar untuk lihat isinya.</p></div></Reveal>
        <Reveal><PillarTabs /></Reveal>
      </div></section>

      <section className="sec" id="hitung"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Coba hitung sendiri</span><h2>Seberapa besar yang hilang kalau ternak mati?</h2><p>Geser angkanya dan lihat sendiri. Angka kecil per hari bisa jadi besar kalau dibiarkan.</p></div></Reveal>
        <Reveal><LossCalculator /></Reveal>
      </div></section>

      <section className="sec alt" id="cara"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Cara kerjanya</span><h2>Mulai dalam tiga langkah. Nggak perlu pelatihan panjang.</h2></div></Reveal>
        <div className="grid g3 steps2">
          {[["Daftarkan farm dan batch", "Isi nama farm, pilih jenis ternak, dan masukkan jumlah awal. Selesai dalam beberapa menit."], ["Catat tiap hari dari HP", "Petugas cukup pilih batch, isi angka, lalu simpan. Mau offline pun nggak masalah."], ["Pantau dan ambil keputusan", "Lihat populasi, kematian, dan tren bobot di dashboard. Keputusan jadi berdasarkan data, bukan feeling."]].map(([t, d], i) => (
            <Reveal key={t} delay={i * 120}><div className="card step"><span className="step-n">{i + 1}</span><h3 className="mb-1">{t}</h3><p className="muted">{d}</p></div></Reveal>))}
        </div>
      </div></section>

      <section className="sec"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Kenapa Nusa Ternak</span><h2>Dibuat untuk kondisi kandang yang sebenarnya</h2><p>Bukan sekadar aplikasi bagus di layar laptop. Kami bikin supaya benar-benar enak dipakai di lapangan.</p></div></Reveal>
        <div className="grid g4">{WHY.map((w, i) => (<Reveal key={w.title} delay={i * 80}><Spot className="card feat"><div className="kpi-ic"><Icon name={w.icon} size={22} /></div><h3>{w.title}</h3><p>{w.text}</p></Spot></Reveal>))}</div>
      </div></section>

      <section className="sec alt" id="peta"><div className="wrap-x">
        <Reveal><div className="sec-h"><span className="eyebrow">Peta pengembangan</span><h2>Kami terbuka soal progresnya</h2><p>Nggak semua fitur sudah jadi, dan kami bilang apa adanya. Ini kondisi terbaru.</p></div></Reveal>
        <div className="grid g3">
          {PILLARS.map((p, i) => { const d = p.modules.filter((m) => m.status === "done").length; return (
            <Reveal key={p.id} delay={i * 60}><div className="card card-pad"><div className="row between mb-1"><b>{p.name}</b><span className="pill">{d}/{p.modules.length}</span></div><div className="progress"><i style={{ width: `${(d / p.modules.length) * 100}%` }} /></div><p className="xs muted mt-1">{d === 0 ? "Masih direncanakan" : d === p.modules.length ? "Sudah lengkap" : "Sebagian sudah bisa dipakai"}</p></div></Reveal>); })}
        </div>
        <p className="mt-3"><Link href="/produk" className="btn btn-secondary">Lihat semua produk <Icon name="arrowRight" size={16} /></Link></p>
      </div></section>

      <section className="sec" id="faq"><div className="wrap-x" style={{ maxWidth: 820 }}>
        <Reveal><div className="sec-h"><span className="eyebrow">Pertanyaan umum</span><h2>Masih penasaran? Ini jawabannya</h2></div></Reveal>
        <div className="faq">{FAQ.map(([q, a]) => (<details key={q}><summary>{q}<Icon name="chevron" size={18} /></summary><p>{a}</p></details>))}</div>
      </div></section>

      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap-x"><Reveal>
        <div className="cta dark"><div className="aurora" aria-hidden="true" />
          <div style={{ position: "relative" }}><div style={{ display: "inline-flex", color: "#fff", marginBottom: 14 }}><Logo light /></div>
            <h2>Yuk, mulai rapikan kandang kamu hari ini</h2><p>Tinggal masuk dan buat farm pertama kamu. Prosesnya cuma beberapa menit.</p>
            <Link href="/login" className="btn btn-lg btn-light glow">Coba sekarang <Icon name="arrowRight" size={18} /></Link></div>
        </div></Reveal></div></section>
    </>
  );
}
