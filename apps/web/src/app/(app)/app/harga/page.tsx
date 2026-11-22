"use client";
import { useCallback, useEffect, useState } from "react";
import { Line } from "@/components/charts";
import { Empty, Modal, Skeleton, fmtDate, useToast } from "@/components/ui";
import { api } from "@/lib/api";

interface Forecast { points: number; latest: number; average30d: number | null; changePct30d: number | null; trend: "naik" | "turun" | "stabil"; confidence: "tinggi" | "sedang" | "rendah"; in7d: number | null; in14d: number | null; in30d: number | null; band: number | null; note: string | null }
interface Summary { commodity: string; unit: string; series: { date: string; price: number }[]; forecast: Forecast }
interface Recent { id: string; commodity: string; unit: string; price: number; region: string | null; source: string | null; observedOn: string }
interface Data { commodities: string[]; summary: Summary[]; recent: Recent[] }

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const label = (c: string) => c.toLowerCase().split("_").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");
const today = () => new Date().toISOString().slice(0, 10);
const TREND = { naik: "Naik", turun: "Turun", stabil: "Stabil" } as const;

export default function HargaPage() {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ commodity: "AYAM_HIDUP", unit: "kg", price: "", region: "", source: "", observedOn: today() });

  const load = useCallback(() => { api<{ data: Data }>("/prices").then((r) => setData(r.data)).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true);
    try {
      await api("/prices", { body: { commodity: f.commodity, unit: f.unit || "kg", price: Number(f.price), region: f.region || undefined, source: f.source || undefined, observedOn: f.observedOn } });
      toast({ kind: "ok", title: "Harga dicatat" }); setOpen(false); setF({ ...f, price: "" }); load();
    } catch (e) { toast({ kind: "err", title: (e as Error).message }); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    try { await api(`/prices/${id}`, { method: "DELETE" }); toast({ kind: "ok", title: "Catatan dibatalkan" }); load(); } catch (e) { toast({ kind: "err", title: (e as Error).message }); }
  }

  return (
    <main className="page">
      <div className="page-h"><div><h1>Harga pasar</h1><p>Catat harga yang kamu temui, lihat tren, dan perkiraan beberapa hari ke depan.</p></div><button className="btn btn-primary" onClick={() => setOpen(true)}>Catat harga</button></div>
      <div className="alert info" style={{ marginBottom: 16 }}>Harga di sini adalah catatan organisasimu sendiri (survei pasar, pengepul, tawaran pembeli). Perkiraan memakai garis tren sederhana dan bisa meleset saat ada musim hari raya atau wabah.</div>
      {error && <div className="alert err">{error}</div>}
      {!data ? <Skeleton h={240} /> : data.summary.length === 0 ? <Empty icon="chart" title="Belum ada catatan harga" text="Catat harga ayam, telur, sapi, atau pakan secara rutin untuk melihat tren." action={<button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>Catat harga pertama</button>} /> : (<>
        <div className="grid g2">{data.summary.map((s) => (
          <div className="card card-pad" key={s.commodity}>
            <div className="row" style={{ justifyContent: "space-between" }}><h3>{label(s.commodity)}</h3><span className={`badge ${s.forecast.trend === "turun" ? "warn" : "ok"}`}>{TREND[s.forecast.trend]}</span></div>
            <div className="row mt-1" style={{ gap: 20, flexWrap: "wrap" }}>
              <div><div className="xs muted">Terakhir</div><b>{rp(s.forecast.latest)}/{s.unit}</b></div>
              <div><div className="xs muted">Rata-rata 30 hari</div><b>{s.forecast.average30d ? rp(s.forecast.average30d) : "-"}</b></div>
              <div><div className="xs muted">Vs 30 hari sebelumnya</div><b>{s.forecast.changePct30d == null ? "-" : `${s.forecast.changePct30d > 0 ? "+" : ""}${s.forecast.changePct30d}%`}</b></div>
            </div>
            {s.series.length >= 2 && <div className="mt-2"><Line labels={s.series.map((p) => fmtDate(p.date).slice(0, 6))} values={s.series.map((p) => p.price)} height={130} /></div>}
            {s.forecast.in7d != null ? <p className="sm mt-1">Perkiraan: <b>{rp(s.forecast.in7d)}</b> (7 hari), <b>{rp(s.forecast.in14d!)}</b> (14 hari), <b>{rp(s.forecast.in30d!)}</b> (30 hari){s.forecast.band ? <> · kisaran ±{rp(s.forecast.band)}</> : null}. Keyakinan: {s.forecast.confidence}.</p> : null}
            {s.forecast.note && <p className="xs muted">{s.forecast.note}</p>}
          </div>))}</div>
        <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Catatan terbaru</h2>
        <div className="card"><div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>
          {data.recent.map((r) => (
            <div className="list-item" key={r.id}>
              <div className="grow"><div style={{ fontWeight: 600 }}>{label(r.commodity)} · {rp(r.price)}/{r.unit}</div><div className="xs muted">{fmtDate(r.observedOn)}{r.region ? ` · ${r.region}` : ""}{r.source ? ` · ${r.source}` : ""}</div></div>
              <button className="btn btn-sm" onClick={() => remove(r.id)}>Batalkan</button>
            </div>))}
        </div></div>
      </>)}
      {open && (
        <Modal title="Catat harga pasar" onClose={() => setOpen(false)} footer={<><button className="btn" onClick={() => setOpen(false)}>Batal</button><button className="btn btn-primary" disabled={busy || !(Number(f.price) > 0)} onClick={save}>Simpan</button></>}>
          <div className="field"><label htmlFor="pc">Komoditas</label><select id="pc" className="input" value={f.commodity} onChange={(e) => setF({ ...f, commodity: e.target.value })}>{(data?.commodities ?? []).map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></div>
          <div className="grid g2">
            <div className="field"><label htmlFor="pp">Harga (Rp)</label><input id="pp" className="input" type="number" min="0" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div className="field"><label htmlFor="pu">Satuan</label><input id="pu" className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="kg, butir, ekor, liter" /></div>
          </div>
          <div className="field"><label htmlFor="pd">Tanggal</label><input id="pd" className="input" type="date" max={today()} value={f.observedOn} onChange={(e) => setF({ ...f, observedOn: e.target.value })} /></div>
          <div className="grid g2">
            <div className="field"><label htmlFor="pr">Wilayah (opsional)</label><input id="pr" className="input" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></div>
            <div className="field"><label htmlFor="ps">Sumber (opsional)</label><input id="ps" className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="pasar, pengepul, pembeli" /></div>
          </div>
        </Modal>)}
    </main>
  );
}
