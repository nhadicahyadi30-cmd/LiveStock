"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useMe } from "@/components/app-shell";
import { IotGuide } from "@/components/iot-guide";
import { Empty, Modal, Skeleton, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { METRIC_INFO } from "@sl/validation";

interface Device { id: string; name: string; locationName: string | null; status: string; farmName: string; tokenPrefix: string; lastSeenAt: string | null; online: boolean; latest: { metric: string; value: number; at: string }[]; openAlerts: { id: string; name: string; metric: string; value: number }[] }
interface Farm { id: string; name: string }
const ago = (iso: string | null) => { if (!iso) return "belum pernah"; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "baru saja" : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`; };

export default function IotPage() {
  const me = useMe();
  const toast = useToast();
  const role = me?.organizations.find((o) => o.id === me.activeOrganizationId)?.role;
  const canManage = role === "OWNER" || role === "MANAGER";
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [modal, setModal] = useState<"new" | "guide" | null>(null);
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => api<{ data: Device[] }>("/iot/devices").then((r) => setDevices(r.data)).catch((e: Error) => { setErr(e.message); setDevices([]); }), []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { api<{ data: Farm[] }>("/farms").then((r) => setFarms(r.data)).catch(() => undefined); }, []);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(null);
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ data: { name: string; token: string } }>("/iot/devices", { body: { name: f.get("name"), farmId: f.get("farmId"), locationName: String(f.get("location") ?? "").trim() || undefined } });
      setCreated(r.data); await load();
    } catch (x) { setErr(x instanceof ApiFailure ? x.message : "Gagal mendaftarkan perangkat"); } finally { setBusy(false); }
  }

  return (
    <main className="page">
      <div className="page-h"><div><h1>Smart Ternak IoT</h1><p>Hubungkan sensor dan perangkat di kandang lewat HTTP atau Node-RED, pantau datanya, dan atur alarm.</p></div>
        <div className="row" style={{ gap: 8 }}><button className="btn btn-secondary" onClick={() => setModal("guide")}>Cara menyambungkan</button>{canManage && <button className="btn btn-primary" onClick={() => { setErr(null); setCreated(null); setModal("new"); }}>Tambah perangkat</button>}</div></div>
      {err && !modal && <div className="alert err">{err}</div>}
      {devices === null ? <Skeleton h={180} /> : devices.length === 0 ? <Empty icon="cpu" title="Belum ada perangkat" text="Daftarkan perangkat pertama, lalu kirim data dengan token yang diberikan." /> : (
        <div className="grid g3">{devices.map((d) => (
          <Link key={d.id} href={`/app/iot/${d.id}`} className="card card-pad" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="row" style={{ justifyContent: "space-between" }}><h3>{d.name}</h3><span className={`badge dot ${d.status !== "ACTIVE" ? "" : d.online ? "ok" : "warn"}`}>{d.status !== "ACTIVE" ? "Nonaktif" : d.online ? "Online" : "Offline"}</span></div>
            <div className="xs muted">{d.farmName}{d.locationName ? ` · ${d.locationName}` : ""} · terakhir {ago(d.lastSeenAt)}</div>
            <div className="row mt-2" style={{ gap: 16, flexWrap: "wrap" }}>{d.latest.length === 0 ? <span className="muted sm">Belum ada data</span> : d.latest.slice(0, 4).map((l) => { const i = METRIC_INFO[l.metric]; return (<div key={l.metric}><div className="xs muted">{i?.label ?? l.metric}</div><div style={{ fontWeight: 700, fontSize: 18 }}>{Math.round(l.value * 10) / 10}<span className="muted sm"> {i?.unit}</span></div></div>); })}</div>
            {d.openAlerts.length > 0 && <div className="alert err mt-2" style={{ marginBottom: 0 }}>{d.openAlerts.map((a) => a.name).join(", ")}</div>}
          </Link>))}</div>)}

      {modal === "guide" && <Modal title="Cara menyambungkan perangkat" onClose={() => setModal(null)}><p className="sm muted">Setiap perangkat punya token sendiri. Kirim data JSON ke alamat berikut; nama metrik bebas (huruf kecil, angka, garis bawah). Maks. 120 permintaan per menit per perangkat.</p><IotGuide /></Modal>}
      {modal === "new" && (<Modal title="Tambah perangkat" onClose={() => { setModal(null); setCreated(null); }}>
        {created ? (<div className="stack"><div className="alert info">Simpan token ini sekarang. Demi keamanan, token tidak akan ditampilkan lagi (kalau hilang, buat token baru di halaman perangkat).</div>
          <input className="input" readOnly value={created.token} onFocus={(e) => e.currentTarget.select()} aria-label="Token perangkat" />
          <button className="btn btn-secondary btn-sm" onClick={() => { void navigator.clipboard.writeText(created.token).then(() => toast({ kind: "ok", title: "Token disalin" })).catch(() => undefined); }}>Salin token</button>
          <IotGuide token={created.token} /></div>) : (
          <form onSubmit={(e) => void create(e)} className="stack">
            <div className="field"><label htmlFor="name">Nama perangkat</label><input id="name" name="name" className="input" required minLength={2} maxLength={80} placeholder="contoh: Sensor Kandang A" /></div>
            <div className="grid g2"><div className="field"><label htmlFor="farmId">Farm</label><select id="farmId" name="farmId" className="input" required defaultValue=""><option value="" disabled>Pilih farm</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
              <div className="field"><label htmlFor="location">Lokasi / kandang</label><input id="location" name="location" className="input" maxLength={80} placeholder="contoh: Kandang A, sisi timur" /></div></div>
            {err && <div className="alert err">{err}</div>}<button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Mendaftarkan…" : "Daftarkan perangkat"}</button></form>)}
      </Modal>)}
    </main>
  );
}
