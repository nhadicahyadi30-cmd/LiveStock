"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Line } from "@/components/charts";
import { Icon } from "@/components/icons";
import { Empty, Modal, Skeleton, Spinner, fmt, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

interface Weight { id: string; measuredOn: string; weightKg: number; sampleSize: number | null; voidedAt: string | null; voidReason: string | null }
interface Mortality { id: string; occurredOn: string; count: number; cause: string; note: string | null; voidedAt: string | null; voidReason: string | null }
interface Detail { batch: { id: string; code: string; status: string; startDate: string; initialCount: number; currentCount: number }; weights: Weight[]; mortalities: Mortality[] }
const CAUSE: Record<string, string> = { DISEASE: "Penyakit", INJURY: "Cedera", PREDATION: "Predator", ENVIRONMENT: "Lingkungan", UNKNOWN: "Tidak diketahui", OTHER: "Lainnya" };

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ kind: "weight" | "mortality"; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => api<{ data: Detail }>(`/batches/${id}`).then((r) => setD(r.data)).catch((e: Error) => setError(e.message)), [id]);
  useEffect(() => { void load(); }, [load]);

  async function doVoid(reason: string) {
    if (!target) return;
    setBusy(true); setErr(null);
    try {
      await api(`/${target.kind === "weight" ? "weight-records" : "mortality-records"}/${target.id}/void`, { body: { reason } });
      toast({ kind: "ok", title: "Catatan dibatalkan" }); setTarget(null); await load();
    } catch (e) { setErr(e instanceof ApiFailure && e.status === 403 ? "Anda tidak boleh membatalkan catatan ini (petugas hanya 24 jam untuk catatan sendiri)." : e instanceof Error ? e.message : "Gagal"); }
    finally { setBusy(false); }
  }

  if (error) return <main className="page"><div className="alert err">{error}</div><Link href="/app/ternak" className="btn btn-secondary"><Icon name="arrowLeft" size={18} /> Kembali</Link></main>;
  if (!d) return <main className="page"><Skeleton h={34} w={240} /><div className="grid g4 mt-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={110} />)}</div></main>;

  const activeW = d.weights.filter((w) => !w.voidedAt).slice().reverse();
  const lastW = activeW[activeW.length - 1];
  const dead = d.mortalities.filter((m) => !m.voidedAt).reduce((n, m) => n + m.count, 0);
  const pct = d.batch.initialCount ? ((dead / d.batch.initialCount) * 100).toFixed(1) : "0";

  return (
    <main className="page">
      <Link href="/app/ternak" className="sm row" style={{ marginBottom: 12 }}><Icon name="arrowLeft" size={16} /> Semua batch</Link>
      <div className="page-h">
        <div><h1>{d.batch.code} <span className={`badge dot ${d.batch.status === "ACTIVE" ? "ok" : ""}`} style={{ verticalAlign: "middle" }}>{d.batch.status === "ACTIVE" ? "Aktif" : "Ditutup"}</span></h1><p>Mulai {fmtDate(d.batch.startDate)}</p></div>
        <Link href="/app/catat" className="btn btn-primary"><Icon name="plus" size={18} /> Tambah catatan</Link>
      </div>

      <div className="grid g4">
        <div className="card kpi"><div className="kpi-top">Populasi saat ini<span className="kpi-ic"><Icon name="layers" size={18} /></span></div><div className="kpi-v">{fmt(d.batch.currentCount)}</div><div className="kpi-s">dari {fmt(d.batch.initialCount)} awal</div></div>
        <div className="card kpi"><div className="kpi-top">Kematian<span className="kpi-ic red"><Icon name="skull" size={18} /></span></div><div className="kpi-v">{fmt(dead)}</div><div className="kpi-s">{pct}% dari populasi awal</div></div>
        <div className="card kpi"><div className="kpi-top">Bobot terakhir<span className="kpi-ic blue"><Icon name="scale" size={18} /></span></div><div className="kpi-v">{lastW ? `${lastW.weightKg}` : "-"}<span className="muted" style={{ fontSize: 16 }}> kg</span></div><div className="kpi-s">{lastW ? fmtDate(lastW.measuredOn) : "belum ada data"}</div></div>
        <div className="card kpi"><div className="kpi-top">Jumlah penimbangan<span className="kpi-ic amber"><Icon name="chart" size={18} /></span></div><div className="kpi-v">{activeW.length}</div><div className="kpi-s">catatan aktif</div></div>
      </div>

      <div className="card mt-2"><div className="card-h"><h3>Tren bobot rata-rata (kg)</h3></div><div className="card-b">
        {activeW.length < 2 ? <Empty icon="chart" title="Belum cukup data" text="Catat bobot minimal dua kali untuk melihat tren." /> : <Line unit=" kg" labels={activeW.map((w) => fmtDate(w.measuredOn).slice(0, 6))} values={activeW.map((w) => w.weightKg)} />}
      </div></div>

      <div className="grid g2 mt-2">
        <div className="card"><div className="card-h"><h3>Catatan bobot</h3></div>
          {d.weights.length === 0 ? <Empty icon="scale" title="Belum ada catatan bobot" /> : <div className="table-wrap"><table className="table"><thead><tr><th>Tanggal</th><th className="num">Bobot</th><th /></tr></thead><tbody>
            {d.weights.map((w) => (<tr key={w.id} style={w.voidedAt ? { opacity: .55 } : undefined}><td>{fmtDate(w.measuredOn)}{w.sampleSize ? <span className="muted xs"> · {w.sampleSize} sampel</span> : null}</td><td className="num">{w.weightKg} kg</td>
              <td className="tr">{w.voidedAt ? <span className="badge" title={w.voidReason ?? ""}>Dibatalkan</span> : <button className="btn btn-ghost btn-sm" onClick={() => { setErr(null); setTarget({ kind: "weight", id: w.id }); }}>Batalkan</button>}</td></tr>))}</tbody></table></div>}
        </div>
        <div className="card"><div className="card-h"><h3>Catatan kematian</h3></div>
          {d.mortalities.length === 0 ? <Empty icon="skull" title="Belum ada kematian tercatat" /> : <div className="table-wrap"><table className="table"><thead><tr><th>Tanggal</th><th>Penyebab</th><th className="num">Ekor</th><th /></tr></thead><tbody>
            {d.mortalities.map((m) => (<tr key={m.id} style={m.voidedAt ? { opacity: .55 } : undefined}><td>{fmtDate(m.occurredOn)}</td><td>{CAUSE[m.cause] ?? m.cause}</td><td className="num">{m.count}</td>
              <td className="tr">{m.voidedAt ? <span className="badge" title={m.voidReason ?? ""}>Dibatalkan</span> : <button className="btn btn-ghost btn-sm" onClick={() => { setErr(null); setTarget({ kind: "mortality", id: m.id }); }}>Batalkan</button>}</td></tr>))}</tbody></table></div>}
        </div>
      </div>

      {target && (
        <Modal title="Batalkan catatan" onClose={() => setTarget(null)} footer={<><button className="btn btn-secondary" onClick={() => setTarget(null)} type="button">Kembali</button><button className="btn btn-danger" form="f-void" type="submit" disabled={busy}>{busy ? <><Spinner /> Memproses…</> : "Batalkan catatan"}</button></>}>
          <form id="f-void" onSubmit={(e) => { e.preventDefault(); void doVoid(String(new FormData(e.currentTarget).get("reason"))); }}>
            {err && <div className="alert err" role="alert">{err}</div>}
            <p className="muted mb-2">Catatan tidak dihapus, hanya ditandai batal dan tidak dihitung lagi. Tindakan ini tercatat di audit.</p>
            <div className="field"><label htmlFor="reason">Alasan</label><input id="reason" name="reason" className="input" required minLength={3} maxLength={300} placeholder="contoh: salah input angka" /></div>
          </form>
        </Modal>)}
    </main>
  );
}
