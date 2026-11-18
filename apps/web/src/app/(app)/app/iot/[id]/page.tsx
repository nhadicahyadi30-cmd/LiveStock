"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Line } from "@/components/charts";
import { useMe } from "@/components/app-shell";
import { IotGuide } from "@/components/iot-guide";
import { Empty, Modal, Skeleton, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { METRIC_INFO } from "@sl/validation";

interface Dev { id: string; name: string; locationName: string | null; status: string; tokenPrefix: string; lastSeenAt: string | null; online: boolean; metrics: string[] }
interface Pt { t: string; v: number; min: number; max: number }
interface Rule { id: string; deviceId: string; name: string; metric: string; op: "GT" | "LT"; threshold: number; enabled: boolean }
interface Alert { id: string; deviceId: string; ruleName: string; metric: string; value: number; threshold: number; op: string; triggeredAt: string; resolvedAt: string | null }
interface Cmd { id: string; command: string; payload: Record<string, unknown> | null; status: string; createdAt: string; result: string | null }
const RANGES: [number, string][] = [[6, "6 jam"], [24, "24 jam"], [72, "3 hari"], [168, "7 hari"], [720, "30 hari"]];
const lbl = (m: string) => METRIC_INFO[m]?.label ?? m;
const unit = (m: string) => METRIC_INFO[m]?.unit ?? "";

export default function DevicePage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const toast = useToast();
  const role = me?.organizations.find((o) => o.id === me.activeOrganizationId)?.role;
  const canManage = role === "OWNER" || role === "MANAGER";
  const [dev, setDev] = useState<Dev | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState("");
  const [hours, setHours] = useState(24);
  const [pts, setPts] = useState<Pt[] | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cmds, setCmds] = useState<Cmd[]>([]);
  const [modal, setModal] = useState<null | "rule" | "token">(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadDev = useCallback(() => api<{ data: Dev }>(`/iot/devices/${id}`).then((r) => { setDev(r.data); setMetric((m) => m || r.data.metrics[0] || ""); }).catch((e: Error) => setError(e.message)), [id]);
  const loadSide = useCallback(() => {
    api<{ data: Rule[] }>("/iot/rules").then((r) => setRules(r.data.filter((x) => x.deviceId === id))).catch(() => undefined);
    api<{ data: Alert[] }>("/iot/alerts").then((r) => setAlerts(r.data.filter((x) => x.deviceId === id))).catch(() => undefined);
    api<{ data: Cmd[] }>(`/iot/devices/${id}/commands`).then((r) => setCmds(r.data)).catch(() => undefined);
  }, [id]);
  useEffect(() => { void loadDev(); loadSide(); const t = setInterval(() => { void loadDev(); loadSide(); }, 30000); return () => clearInterval(t); }, [loadDev, loadSide]);
  useEffect(() => { if (!metric) return; setPts(null); api<{ data: { points: Pt[] } }>(`/iot/devices/${id}/readings?metric=${metric}&hours=${hours}`).then((r) => setPts(r.data.points)).catch(() => setPts([])); }, [id, metric, hours, dev?.lastSeenAt]);

  async function run(fn: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(true); setErr(null);
    try { await fn(); toast({ kind: "ok", title: ok }); after?.(); await loadDev(); loadSide(); }
    catch (x) { const m = x instanceof ApiFailure ? (x.code === "VALIDATION_ERROR" ? "Periksa isian." : x.message) : "Gagal"; setErr(m); toast({ kind: "err", title: m }); }
    finally { setBusy(false); }
  }
  const addRule = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => api("/iot/rules", { body: { deviceId: id, name: f.get("name"), metric: String(f.get("metric")).trim().toLowerCase(), op: f.get("op"), threshold: Number(f.get("threshold")) } }), "Alarm dibuat", () => setModal(null)); };
  const sendCmd = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const arg = String(f.get("arg") ?? "").trim(); void run(() => api(`/iot/devices/${id}/commands`, { body: { command: String(f.get("command")).trim().toLowerCase(), payload: arg ? { value: Number.isNaN(Number(arg)) ? arg : Number(arg) } : undefined } }), "Perintah diantrekan", () => form.reset()); };

  if (error) return <main className="page"><div className="alert err">{error}</div><Link href="/app/iot" className="btn btn-secondary">Kembali</Link></main>;
  if (!dev) return <main className="page"><Skeleton h={260} /></main>;
  const vals = (pts ?? []).map((p) => Math.round(p.v * 100) / 100);
  const fmtT = (t: string) => { const d = new Date(t); return hours <= 72 ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : fmtDate(t).slice(0, 6); };

  return (
    <main className="page">
      <Link href="/app/iot" className="sm" style={{ display: "inline-block", marginBottom: 12 }}>← Semua perangkat</Link>
      <div className="page-h"><div><h1>{dev.name} <span className={`badge dot ${dev.status !== "ACTIVE" ? "" : dev.online ? "ok" : "warn"}`}>{dev.status !== "ACTIVE" ? "Nonaktif" : dev.online ? "Online" : "Offline"}</span></h1><p>{dev.locationName ?? "Tanpa lokasi"} · token {dev.tokenPrefix}…</p></div>
        {canManage && <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => void run(() => api(`/iot/devices/${id}`, { method: "PATCH", body: { status: dev.status === "ACTIVE" ? "DISABLED" : "ACTIVE" } }), dev.status === "ACTIVE" ? "Perangkat dinonaktifkan" : "Perangkat diaktifkan")}>{dev.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}</button>
          <button className="btn btn-secondary" onClick={() => { if (window.confirm("Buat token baru? Token lama langsung berhenti berlaku dan perangkat harus diperbarui.")) void run(async () => { const r = await api<{ data: { token: string } }>(`/iot/devices/${id}/token`, { body: {} }); setNewToken(r.data.token); setModal("token"); }, "Token baru dibuat"); }}>Token baru</button></div>}</div>

      <div className="card">
        <div className="card-h"><h3>Grafik</h3><div className="row" style={{ gap: 8 }}>
          <select className="input" style={{ width: "auto" }} value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metrik">{dev.metrics.map((m) => <option key={m} value={m}>{lbl(m)}</option>)}</select>
          <select className="input" style={{ width: "auto" }} value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Rentang">{RANGES.map(([h, l]) => <option key={h} value={h}>{l}</option>)}</select></div></div>
        <div className="card-b">
          {dev.metrics.length === 0 ? (<div><Empty icon="cpu" title="Belum ada data masuk" text="Kirim data dari perangkat memakai contoh di bawah, atau isi data contoh untuk mencoba tampilan." />{canManage && <div style={{ textAlign: "center" }}><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => api(`/iot/devices/${id}/simulate`, { body: {} }), "Data contoh 24 jam terisi")}>Isi data contoh</button></div>}</div>)
            : pts === null ? <Skeleton h={180} /> : vals.length < 2 ? <Empty icon="chart" title="Data belum cukup" text="Belum ada cukup titik di rentang waktu ini." /> : <><Line unit={` ${unit(metric)}`} labels={(pts ?? []).map((p) => fmtT(p.t))} values={vals} /><div className="xs muted mt-1">Rata-rata per periode · terendah {Math.min(...(pts ?? []).map((p) => p.min)).toFixed(1)} · tertinggi {Math.max(...(pts ?? []).map((p) => p.max)).toFixed(1)} {unit(metric)}</div></>}
        </div>
      </div>

      <div className="grid g2 mt-2">
        <div className="card"><div className="card-h"><h3>Alarm</h3>{canManage && <button className="btn btn-secondary btn-sm" onClick={() => { setErr(null); setModal("rule"); }}>Tambah alarm</button>}</div>
          {rules.length === 0 ? <Empty icon="alert" title="Belum ada alarm" text="Contoh: suhu di atas 32 °C. Pemilik dan manajer dapat notifikasi saat terlewati." /> : <div className="table-wrap"><table className="table"><tbody>{rules.map((r) => (<tr key={r.id} style={r.enabled ? undefined : { opacity: .55 }}><td>{r.name}<div className="xs muted">{lbl(r.metric)} {r.op === "GT" ? ">" : "<"} {r.threshold} {unit(r.metric)}</div></td>
            <td className="tr">{canManage && <><button className="btn btn-ghost btn-sm" onClick={() => void run(() => api(`/iot/rules/${r.id}`, { method: "PATCH", body: { enabled: !r.enabled } }), r.enabled ? "Alarm dimatikan" : "Alarm dinyalakan")}>{r.enabled ? "Matikan" : "Nyalakan"}</button><button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm(`Hapus alarm "${r.name}"?`)) void run(() => api(`/iot/rules/${r.id}`, { method: "DELETE" }), "Alarm dihapus"); }}>Hapus</button></>}</td></tr>))}</tbody></table></div>}
          {alerts.length > 0 && <div style={{ padding: "0 16px 12px" }}><div className="xs muted" style={{ margin: "8px 0 4px" }}>Riwayat</div>{alerts.slice(0, 6).map((a) => <div key={a.id} className="sm">{a.resolvedAt ? "✓" : "⚠"} {a.ruleName}: {a.value} {unit(a.metric)} · {new Date(a.triggeredAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{a.resolvedAt ? " (normal lagi)" : " (masih berlangsung)"}</div>)}</div>}
        </div>
        <div className="card"><div className="card-h"><h3>Kendali perangkat</h3></div><div className="card-b">
          {canManage && <form onSubmit={sendCmd} className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ margin: 0 }}><label htmlFor="command">Perintah</label><input id="command" name="command" className="input" required placeholder="feeder_on" pattern="[a-z][a-z0-9_]{0,39}" /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="arg">Nilai (opsional)</label><input id="arg" name="arg" className="input" placeholder="10" style={{ width: 100 }} /></div>
            <button className="btn btn-primary" disabled={busy || dev.status !== "ACTIVE"}>Kirim</button></form>}
          <p className="xs muted mt-1">Perintah menunggu sampai perangkat mengambilnya (polling) dan mengonfirmasi.</p>
          {cmds.length === 0 ? <p className="sm muted mt-1">Belum ada perintah.</p> : cmds.slice(0, 6).map((c) => <div key={c.id} className="sm mt-1"><b>{c.command}</b>{c.payload ? ` ${JSON.stringify(c.payload)}` : ""} · <span className="badge">{c.status === "PENDING" ? "Menunggu" : c.status === "SENT" ? "Terkirim" : "Dikonfirmasi"}</span>{c.result ? ` ${c.result}` : ""}</div>)}
        </div></div>
      </div>

      <div className="card mt-2"><div className="card-h"><h3>Cara mengirim data</h3></div><div className="card-b"><IotGuide /></div></div>

      {modal === "rule" && (<Modal title="Tambah alarm" onClose={() => setModal(null)}><form onSubmit={addRule} className="stack">
        <div className="field"><label htmlFor="rname">Nama alarm</label><input id="rname" name="name" className="input" required minLength={2} maxLength={100} placeholder="Suhu terlalu panas" /></div>
        <div className="field"><label htmlFor="rmetric">Metrik</label><input id="rmetric" name="metric" list="mlist" className="input" required defaultValue={metric} pattern="[a-z][a-z0-9_]{0,39}" /><datalist id="mlist">{[...new Set([...dev.metrics, ...Object.keys(METRIC_INFO)])].map((m) => <option key={m} value={m}>{lbl(m)}</option>)}</datalist></div>
        <div className="grid g2"><div className="field"><label htmlFor="rop">Kondisi</label><select id="rop" name="op" className="input" defaultValue="GT"><option value="GT">Lebih dari</option><option value="LT">Kurang dari</option></select></div><div className="field"><label htmlFor="rth">Batas</label><input id="rth" name="threshold" type="number" step="any" className="input" required /></div></div>
        {err && <div className="alert err">{err}</div>}<button className="btn btn-primary btn-block" disabled={busy}>Simpan alarm</button></form></Modal>)}
      {modal === "token" && newToken && (<Modal title="Token baru" onClose={() => { setModal(null); setNewToken(null); }}><div className="stack"><div className="alert info">Simpan sekarang, token tidak ditampilkan lagi. Token lama sudah tidak berlaku.</div><input className="input" readOnly value={newToken} onFocus={(e) => e.currentTarget.select()} aria-label="Token baru" /><IotGuide token={newToken} /></div></Modal>)}
    </main>
  );
}
