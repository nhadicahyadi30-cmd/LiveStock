"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Empty, Modal, Skeleton, useToast } from "@/components/ui";
import { api } from "@/lib/api";

interface Snap { id: string; capturedAt: string; sizeBytes: number }
interface Cam { id: string; name: string; location: string | null; status: string; total: number; snapshots: Snap[] }

const when = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });
const ago = (d: string) => { const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000)); return s < 60 ? `${s} dtk lalu` : s < 3600 ? `${Math.round(s / 60)} mnt lalu` : s < 86400 ? `${Math.round(s / 3600)} jam lalu` : `${Math.round(s / 86400)} hari lalu`; };

export default function KameraPage() {
  const toast = useToast();
  const [cams, setCams] = useState<Cam[] | null>(null);
  const [view, setView] = useState<{ cam: Cam; snap: Snap } | null>(null);
  const load = useCallback(() => { api<{ data: Cam[] }>("/iot/cameras").then((r) => setCams(r.data)).catch(() => setCams([])); }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function remove(s: Snap) {
    if (!window.confirm("Hapus foto ini?")) return;
    try { await api(`/iot/snapshots/${s.id}`, { method: "DELETE" }); toast({ kind: "ok", title: "Foto dihapus" }); setView(null); load(); } catch (e) { toast({ kind: "err", title: (e as Error).message }); }
  }

  return (
    <main className="page">
      <div className="page-h"><div><h1>Kamera kandang</h1><p>Foto terbaru dari kamera yang terhubung. Diperbarui otomatis tiap 15 detik.</p></div></div>
      <div className="alert info" style={{ marginBottom: 16 }}>Ini foto berkala (bukan video langsung). Kamera mengirim gambar lewat HTTP ke Nusa Ternak, mirip sensor. Disimpan 100 foto terakhir atau 14 hari per kamera. Cara menyambungkan ada di <Link href="/app/iot">halaman IoT</Link> dan docs/IOT.md.</div>
      {cams === null ? <Skeleton h={240} /> : cams.length === 0 ? <Empty icon="cpu" title="Belum ada kamera yang mengirim foto" text="Daftarkan perangkat di menu IoT, lalu kirim foto ke /api/iot/v1/snapshots dengan token perangkat." action={<Link href="/app/iot" className="btn btn-primary btn-sm">Buka IoT</Link>} /> : (
        <div className="grid g2">{cams.map((c) => { const latest = c.snapshots[0]; return (
          <div className="card card-pad" key={c.id}>
            <div className="row" style={{ justifyContent: "space-between" }}><h3>{c.name}</h3>{latest && <span className="xs muted">{ago(latest.capturedAt)}</span>}</div>
            {c.location && <div className="xs muted">{c.location}</div>}
            {latest && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/v1/iot/snapshots/${latest.id}`} alt={`Foto terbaru ${c.name}`} loading="lazy" style={{ width: "100%", borderRadius: 8, marginTop: 8, cursor: "zoom-in", background: "#000" }} onClick={() => setView({ cam: c, snap: latest })} />)}
            {c.snapshots.length > 1 && <div className="row mt-1" style={{ gap: 4, overflowX: "auto" }}>{c.snapshots.slice(1).map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.id} src={`/api/v1/iot/snapshots/${s.id}`} alt={`Foto ${when(s.capturedAt)}`} loading="lazy" title={when(s.capturedAt)} style={{ height: 48, borderRadius: 4, cursor: "pointer", flex: "0 0 auto" }} onClick={() => setView({ cam: c, snap: s })} />))}</div>}
            <div className="xs muted mt-1">{c.total} foto tersimpan</div>
          </div>); })}</div>)}
      {view && (
        <Modal title={`${view.cam.name} · ${when(view.snap.capturedAt)}`} onClose={() => setView(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/v1/iot/snapshots/${view.snap.id}`} alt={`Foto ${view.cam.name}`} style={{ width: "100%", borderRadius: 8 }} />
          <button className="btn btn-ghost btn-sm mt-1" onClick={() => void remove(view.snap)}>Hapus foto</button>
        </Modal>)}
    </main>
  );
}
