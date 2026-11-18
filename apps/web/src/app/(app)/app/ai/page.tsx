"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Line } from "@/components/charts";
import { Empty, Skeleton, fmtDate } from "@/components/ui";
import { api } from "@/lib/api";

type Sev = "info" | "warn" | "high";
interface Insight { kind: string; severity: Sev; title: string; detail: string }
interface Forecast { slopeKgPerDay: number; r2: number; confidence: "tinggi" | "sedang" | "rendah"; points: number; currentKg: number; kgIn7d: number; kgIn14d: number; kgIn30d: number; target?: { kg: number; reached: boolean; date: string | null; days: number | null } }
interface BatchInsight { id: string; code: string; population: number; weights: { date: string; kg: number }[]; forecast: Forecast | { error: string }; adgGramPerDay: number | null; fcr: number | null; insights: Insight[] }
interface Data { generatedAt: string; batches: BatchInsight[]; sensor: Insight[] }

const SEV: Record<Sev, string> = { high: "Perlu segera dicek", warn: "Perlu diperhatikan", info: "Catatan" };
const badgeCls = (s: Sev) => (s === "info" ? "" : "warn");
const KEY = "nt.targets";
const readTargets = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>; } catch { return {}; } };

export default function AiPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});

  const load = useCallback((t: Record<string, string>) => {
    const q = Object.entries(t).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k}:${Number(v)}`).join(",");
    api<{ data: Data }>(`/ai/insights${q ? `?targets=${encodeURIComponent(q)}` : ""}`).then((r) => setData(r.data)).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => { const t = readTargets(); setTargets(t); load(t); }, [load]);

  function setTarget(id: string, v: string) {
    const next = { ...targets, [id]: v }; setTargets(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* abaikan */ }
  }

  const alerts = data ? [...data.batches.flatMap((b) => b.insights.map((i) => ({ ...i, where: b.code }))), ...data.sensor.map((i) => ({ ...i, where: "Sensor" }))].sort((a, z) => ["high", "warn", "info"].indexOf(a.severity) - ["high", "warn", "info"].indexOf(z.severity)) : [];

  return (
    <main className="page">
      <div className="page-h"><div><h1>Smart Ternak AI</h1><p>Perkiraan bobot dan waktu panen, efisiensi pakan (FCR), dan peringatan dini dari catatanmu.</p></div></div>
      <div className="alert info" style={{ marginBottom: 16 }}>Ini estimasi statistik sederhana dari data yang kamu catat, bukan diagnosis. Makin rutin catatanmu, makin akurat. Untuk ternak sakit, tetap hubungi dokter hewan.</div>
      {error && <div className="alert err">{error}</div>}
      {!data ? <Skeleton h={240} /> : (<>
        <div className="card">
          <div className="card-h"><h3>Peringatan dini</h3><span className="badge">{alerts.length}</span></div>
          <div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {alerts.length === 0 ? <Empty icon="check" title="Tidak ada yang mencurigakan" text="Belum ada pola kematian, pakan, bobot, atau sensor yang menyimpang." /> : alerts.map((a, i) => (
              <div key={i} className="list-item" style={{ alignItems: "flex-start" }}>
                <div className="grow"><div style={{ fontWeight: 600 }}>{a.title} <span className="muted sm">· {a.where}</span> <span className={`badge ${badgeCls(a.severity)}`}>{SEV[a.severity]}</span></div><div className="sm muted">{a.detail}</div></div>
              </div>))}
          </div>
        </div>

        <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Perkiraan per batch</h2>
        {data.batches.length === 0 ? <Empty icon="layers" title="Belum ada batch aktif" action={<Link href="/app/ternak" className="btn btn-primary btn-sm">Tambah batch</Link>} /> : (
          <div className="grid g2">{data.batches.map((b) => {
            const f = "error" in b.forecast ? null : b.forecast;
            const labels = [...b.weights.map((w) => fmtDate(w.date).slice(0, 6)), ...(f ? ["+7 hr", "+14 hr", "+30 hr"] : [])];
            const values = [...b.weights.map((w) => w.kg), ...(f ? [f.kgIn7d, f.kgIn14d, f.kgIn30d] : [])];
            return (
              <div className="card card-pad" key={b.id}>
                <div className="row" style={{ justifyContent: "space-between" }}><h3><Link href={`/app/ternak/${b.id}`}>{b.code}</Link></h3><span className="xs muted">{b.population.toLocaleString("id-ID")} ekor</span></div>
                {f ? (<>
                  <div className="row mt-1" style={{ gap: 20, flexWrap: "wrap" }}>
                    <div><div className="xs muted">Bobot terakhir</div><b>{f.currentKg} kg</b></div>
                    <div><div className="xs muted">Pertambahan/hari</div><b>{b.adgGramPerDay} g</b></div>
                    <div><div className="xs muted">FCR</div><b>{b.fcr ?? "-"}</b></div>
                    <div><div className="xs muted">Keyakinan</div><span className={`badge ${f.confidence === "rendah" ? "warn" : "ok"}`}>{f.confidence}</span></div>
                  </div>
                  {values.length >= 2 && <div className="mt-2"><Line unit=" kg" labels={labels} values={values} height={140} /></div>}
                  <p className="sm mt-1">Perkiraan: <b>{f.kgIn7d} kg</b> (7 hari), <b>{f.kgIn14d} kg</b> (14 hari), <b>{f.kgIn30d} kg</b> (30 hari).</p>
                  <div className="field mt-1"><label htmlFor={`t-${b.id}`}>Target bobot panen (kg)</label><input id={`t-${b.id}`} className="input" type="number" min="0" step="0.01" inputMode="decimal" value={targets[b.id] ?? ""} onChange={(e) => setTarget(b.id, e.target.value)} onBlur={() => load(targets)} placeholder="contoh: 2.2" /></div>
                  {f.target && <p className="sm">{f.target.reached ? "Target sudah tercapai." : f.target.date ? <>Target {f.target.kg} kg diperkirakan tercapai <b>{fmtDate(f.target.date)}</b> (±{f.target.days} hari lagi).</> : "Dengan tren sekarang target belum bisa diperkirakan (bobot tidak naik atau lebih dari setahun)."}</p>}
                </>) : <p className="sm muted mt-1">{(b.forecast as { error: string }).error}</p>}
              </div>);
          })}</div>)}
        <p className="xs muted mt-2">Cara kerja: garis tren dari 8 penimbangan terakhir (proyeksi linear, pertumbuhan asli biasanya melambat); FCR = pakan ÷ pertambahan bobot seluruh populasi; peringatan = kematian 2 hari vs 2 minggu sebelumnya, pakan 3 hari vs minggu sebelumnya, bobot turun &gt; 3%, dan sensor yang menyimpang dari kebiasaan 7 hari.</p>
      </>)}
    </main>
  );
}
