"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Empty, Skeleton, fmt, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

interface Prod { id: string; batchId: string; kind: "EGG" | "MILK" | "HARVEST"; quantity: number; unit: string; producedOn: string; note: string | null; voidedAt: string | null }
interface Batch { id: string; code: string }
const KIND = { EGG: "Telur", MILK: "Susu", HARVEST: "Panen" } as const;

export default function ProduksiPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Prod[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = () => Promise.all([api<{ data: Prod[] }>("/production-records?limit=100"), api<{ data: Batch[] }>("/batches?limit=100")])
    .then(([p, b]) => { setRows(p.data); setBatches(b.data); })
    .catch((e: Error) => { setErr(e.message); setRows([]); });
  useEffect(() => { void load(); }, []);

  const code = useMemo(() => new Map(batches.map((b) => [b.id, b.code])), [batches]);
  const live = (rows ?? []).filter((r) => !r.voidedAt);
  const since = Date.now() - 30 * 864e5;
  const totals = (["EGG", "MILK", "HARVEST"] as const).map((k) => ({ k, sum: live.filter((r) => r.kind === k && new Date(r.producedOn).getTime() >= since).reduce((s, r) => s + r.quantity, 0) }));

  async function voidRow(id: string) {
    const reason = window.prompt("Alasan membatalkan catatan ini?");
    if (!reason) return;
    try { await api(`/production-records/${id}/void`, { body: { reason } }); toast({ kind: "ok", title: "Catatan dibatalkan" }); await load(); }
    catch (e) { toast({ kind: "err", title: e instanceof ApiFailure ? e.message : "Gagal membatalkan" }); }
  }

  return (
    <main className="page">
      <div className="page-head"><div><h1>Produksi</h1><p className="muted">Telur, susu, dan hasil panen.</p></div><Link href="/app/catat?jenis=production" className="btn btn-primary">Catat produksi</Link></div>
      {err && <div className="alert err">{err}</div>}
      {rows === null ? <Skeleton h={200} /> : (<>
        <div className="grid g3">{totals.map((t) => (<div key={t.k} className="card card-pad"><div className="xs muted">{KIND[t.k]} 30 hari</div><div className="stat">{fmt(Math.round(t.sum))} {t.k === "EGG" ? "butir" : t.k === "MILK" ? "liter" : "kg"}</div></div>))}</div>
        {live.length === 0 ? <div className="mt-3"><Empty icon="layers" title="Belum ada catatan produksi" text="Catat hasil harian untuk memantau produktivitas." /></div> : (
          <div className="card mt-3 table-wrap"><table className="table"><thead><tr><th>Tanggal</th><th>Batch</th><th>Jenis</th><th className="num">Jumlah</th><th /></tr></thead>
            <tbody>{live.map((r) => (<tr key={r.id}><td>{fmtDate(r.producedOn)}</td><td>{code.get(r.batchId) ?? "-"}</td><td>{KIND[r.kind]}</td><td className="num">{fmt(r.quantity)} {r.unit}</td><td><button className="btn btn-ghost btn-sm" onClick={() => void voidRow(r.id)}>Batalkan</button></td></tr>))}</tbody></table></div>
        )}
      </>)}
    </main>
  );
}
