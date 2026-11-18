import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Reveal, Spot } from "@/components/mk/fx";
import { PageHero } from "@/components/mk/page-hero";
import { PILLARS, STATUS_LABEL, type ModuleStatus } from "@/lib/modules";

export const metadata: Metadata = { title: "Produk" };

const META: Record<string, { icon: IconName; tone: string; text: string }> = {
  platform: { icon: "shield", tone: "", text: "Fondasi yang dipakai semua fitur: akun, tim, hak akses, dan keamanan data." },
  "smart-farm": { icon: "farm", tone: "", text: "Jantungnya Nusa Ternak. Semua pencatatan harian di kandang, dari populasi sampai produksi." },
  kesehatan: { icon: "heart", tone: "red", text: "Biar ternak tetap sehat: jadwal vaksin, riwayat pengobatan, dan pencegahan penyakit." },
  marketplace: { icon: "cart", tone: "amber", text: "Tempat jual beli ternak, pakan, dan sarana dengan vendor yang jelas identitasnya." },
  keuangan: { icon: "coin", tone: "blue", text: "Catat uang masuk dan keluar, lalu lihat untung-rugi tiap batch tanpa pusing." },
  "smart-ternak": { icon: "cpu", tone: "", text: "Sensor dan otomasi untuk kandang dan kolam, supaya masalah ketahuan lebih awal." },
  ai: { icon: "spark", tone: "amber", text: "Prediksi dan saran dari data usaha kamu sendiri, makin lama dipakai makin pintar." },
};
const BADGE: Record<ModuleStatus, string> = { done: "ok", progress: "warn", planned: "" };

export default function ProductPage() {
  return (
    <>
      <PageHero eyebrow="Produk" title={<>Semua kebutuhan usaha ternak, <span className="grad">satu tempat.</span></>}>
        Nusa Ternak terdiri dari beberapa pilar yang saling nyambung. Mulai dari yang kamu butuhkan sekarang, tambah yang lain nanti. Datanya tetap satu.
      </PageHero>
      <section className="sec"><div className="wrap-x">
        <div className="alert info mb-3"><Icon name="info" /> Tanda <b>Tersedia</b> artinya sudah bisa dipakai. <b>Dikerjakan</b> sedang dibuat. <b>Direncanakan</b> masuk antrean. Kami terbuka soal ini.</div>
        <div className="grid g2">
          {PILLARS.map((p, i) => { const m = META[p.id] ?? { icon: "grid" as IconName, tone: "", text: p.description }; const d = p.modules.filter((x) => x.status === "done").length; return (
            <Reveal key={p.id} delay={(i % 2) * 80}><Spot className="card card-pad" style={{ height: "100%" }}>
              <div className="row mb-1"><span className={`kpi-ic ${m.tone}`}><Icon name={m.icon} size={20} /></span><div className="grow"><h3 style={{ fontSize: 18 }}>{p.name}</h3></div><span className="pill">{d}/{p.modules.length}</span></div>
              <p className="muted mb-2">{m.text}</p>
              {p.modules.map((x) => (<div className="list-item" key={x.name} style={{ alignItems: "flex-start", padding: "9px 0" }}><div className="grow"><div style={{ fontWeight: 600, fontSize: 14 }}>{x.name}</div>{x.note && <div className="xs muted">{x.note}</div>}</div><span className={`badge ${BADGE[x.status]}`}>{STATUS_LABEL[x.status]}</span></div>))}
            </Spot></Reveal>); })}
        </div>
        <div className="row mt-3 wrap"><Link href="/login" className="btn btn-primary btn-lg">Coba sekarang</Link><Link href="/layanan" className="btn btn-secondary btn-lg">Lihat layanan kami</Link></div>
      </div></section>
    </>
  );
}
