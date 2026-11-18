"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Empty, Skeleton, fmt, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

interface Feed { id: string; batchId: string; feedName: string; givenOn: string; quantityKg: number; costTotal: number | null; note: string | null; voidedAt: string | null }
interface Batch { id: string; code: string }
const rp = (n: number) => `Rp ${fmt(Math.round(n))}`;

export default function PakanPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Feed[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = () => Promise.all([api<{ data: Feed[] }>("/feed-records?limit=100"), api<{ data: Batch[] }>("/batches?limit=100")])
    .then(([f, b]) => { setRows(f.data); setBatches(b.data); })
    .catch((e: Error) => { setErr(e.message); setRows([]); });
  useEffect(() => { void load(); }, []);

  const code = useMemo(() => new Map(batches.map((b) => [b.id, b.code])), [batches]);
  const live = (rows ?? []).filter((r) => !r.voidedAt);
  const since = Date.now() - 30 * 864e5;
  const recent = live.filter((r) => new Date(r.givenOn).getTime() >= since);
  const kg = recent.reduce((s, r) => s + r.quantityKg, 0);
  const cost = recent.reduce((s, r) => s + (r.costTotal ?? 0), 0);

  async function voidRow(id: string) {
    const reason = window.prompt("Alasan membatalkan catatan ini?");
    if (!reason) return;
    try { await api(`/feed-records/${id}/void`, { body: { reason } }); toast({ kind: "ok", title: "Catatan dibatalkan" }); await load(); }
    catch (e) { toast({ kind: "err", title: e instanceof ApiFailure ? e.message : "Gagal membatalkan" }); }
  }

  return (
    <main className="page">
      <div className="page-head"><div><h1>Pakan</h1><p className="muted">Riwayat pemberian pakan dan biayanya.</p></div><Link href="/app/catat?jenis=feed" className="btn btn-primary">Catat pakan</Link></div>
      {err && <div className="alert err">{err}</div>}
      {rows === null ? <Skeleton h={200} /> : (<>
        <div className="grid g3">
          <div className="card card-pad"><div className="xs muted">Pakan 30 hari</div><div className="stat">{fmt(Math.round(kg))} kg</div></div>
          <div className="card card-pad"><div className="xs muted">Biaya 30 hari</div><div className="stat">{rp(cost)}</div></div>
          <div className="card card-pad"><div className="xs muted">Biaya per kg</div><div className="stat">{kg > 0 && cost > 0 ? rp(cost / kg) : "-"}</div></div>
        </div>
        {live.length === 0 ? <div className="mt-3"><Empty icon="layers" title="Belum ada catatan pakan" text="Catat pakan harian untuk melihat konsumsi dan biaya." /></div> : (
          <div className="card mt-3 table-wrap"><table className="table"><thead><tr><th>Tanggal</th><th>Batch</th><th>Pakan</th><th className="num">Jumlah</th><th className="num">Biaya</th><th /></tr></thead>
            <tbody>{live.map((r) => (<tr key={r.id}><td>{fmtDate(r.givenOn)}</td><td>{code.get(r.batchId) ?? "-"}</td><td>{r.feedName}</td><td className="num">{fmt(r.quantityKg)} kg</td><td className="num">{r.costTotal === null ? "-" : rp(r.costTotal)}</td><td><button className="btn btn-ghost btn-sm" onClick={() => void voidRow(r.id)}>Batalkan</button></td></tr>))}</tbody></table></div>
        )}
      </>)}
    </main>
  );
}
