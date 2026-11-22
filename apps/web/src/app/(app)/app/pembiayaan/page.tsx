"use client";
import { useCallback, useEffect, useState } from "react";
import { Empty, Modal, Skeleton, fmtDate, useToast } from "@/components/ui";
import { api } from "@/lib/api";

interface Partner { id: string; name: string; kind: string; description: string; minAmount: number | null; maxAmount: number | null; rateInfo: string | null; contactUrl: string | null; contactPhone: string | null }
interface App { id: string; partner: string; amount: number; tenorMonths: number; purpose: string; note: string | null; status: string; partnerNote: string | null; createdAt: string }
interface Elig { months: number; monthsWithData: number; income: number; expense: number; profit: number; marginPct: number | null; profitableMonths: number; activeBatches: number; openReceivables: number; dataQuality: "cukup" | "kurang"; notes: string[] }

const rp = (n: number) => `${n < 0 ? "-" : ""}Rp ${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
const KIND: Record<string, string> = { BANK: "Bank", KOPERASI: "Koperasi", FINTECH: "Fintech", OFFTAKER: "Offtaker / pembeli kemitraan", LAINNYA: "Lainnya" };
const PURPOSE: Record<string, string> = { MODAL_KERJA: "Modal kerja", PAKAN: "Pakan", KANDANG: "Kandang", PERALATAN: "Peralatan", BIBIT: "Bibit / DOC", LAINNYA: "Lainnya" };
const ST: Record<string, string> = { SUBMITTED: "Terkirim", IN_REVIEW: "Diproses mitra", APPROVED: "Disetujui mitra", REJECTED: "Ditolak mitra", WITHDRAWN: "Ditarik" };

export default function PembiayaanPage() {
  const toast = useToast();
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [apps, setApps] = useState<App[] | null>(null);
  const [elig, setElig] = useState<Elig | null>(null);
  const [apply, setApply] = useState<Partner | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ data: Partner[] }>("/financing/partners").then((r) => setPartners(r.data)).catch(() => setPartners([]));
    api<{ data: App[] }>("/financing/applications").then((r) => setApps(r.data)).catch(() => setApps([]));
    api<{ data: Elig }>("/financing/eligibility").then((r) => setElig(r.data)).catch(() => setElig(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(form: HTMLFormElement) {
    const f = new FormData(form); setBusy(true);
    try {
      await api("/financing/applications", { body: { partnerId: apply!.id, amount: Number(f.get("amount")), tenorMonths: Number(f.get("tenor")), purpose: String(f.get("purpose")), note: String(f.get("note") ?? "").trim() || undefined } });
      toast({ kind: "ok", title: "Pengajuan terkirim" }); setApply(null); load();
    } catch (e) { toast({ kind: "err", title: (e as Error).message }); } finally { setBusy(false); }
  }
  async function withdraw(id: string) {
    if (!window.confirm("Tarik pengajuan ini?")) return;
    try { await api(`/financing/applications/${id}/withdraw`, { body: {} }); toast({ kind: "ok", title: "Pengajuan ditarik" }); load(); } catch (e) { toast({ kind: "err", title: (e as Error).message }); }
  }

  return (
    <main className="page">
      <div className="page-h"><div><h1>Pembiayaan dan mitra</h1><p>Hubungkan usahamu ke bank, koperasi, fintech, atau pembeli kemitraan.</p></div></div>
      <div className="alert warn" style={{ marginBottom: 16 }}>Nusa Ternak hanya menghubungkan dan melampirkan ringkasan catatan keuanganmu. Keputusan, bunga, dan syarat sepenuhnya milik mitra. Ini bukan penilaian kredit dan bukan jaminan disetujui.</div>

      <div className="card card-pad">
        <h3>Ringkasan keuangan 6 bulan (ikut dilampirkan)</h3>
        {!elig ? <Skeleton h={80} /> : (<>
          <div className="row mt-1" style={{ gap: 20, flexWrap: "wrap" }}>
            <div><div className="xs muted">Pemasukan</div><b>{rp(elig.income)}</b></div>
            <div><div className="xs muted">Pengeluaran</div><b>{rp(elig.expense)}</b></div>
            <div><div className="xs muted">Laba</div><b>{rp(elig.profit)}</b></div>
            <div><div className="xs muted">Margin</div><b>{elig.marginPct == null ? "-" : `${elig.marginPct}%`}</b></div>
            <div><div className="xs muted">Bulan untung</div><b>{elig.profitableMonths} / {elig.months}</b></div>
            <div><div className="xs muted">Batch aktif</div><b>{elig.activeBatches}</b></div>
          </div>
          {elig.notes.length > 0 && <ul className="sm muted" style={{ paddingLeft: 18 }}>{elig.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </>)}
      </div>

      <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Mitra tersedia</h2>
      {partners === null ? <Skeleton h={120} /> : partners.length === 0 ? <Empty icon="coin" title="Belum ada mitra" text="Mitra ditambahkan oleh pengelola platform." /> : (
        <div className="grid g2">{partners.map((p) => (
          <div className="card card-pad" key={p.id}>
            <h3>{p.name}</h3><div className="xs muted">{KIND[p.kind]}{p.minAmount || p.maxAmount ? ` · ${p.minAmount ? rp(p.minAmount) : "…"} – ${p.maxAmount ? rp(p.maxAmount) : "…"}` : ""}</div>
            <p className="sm mt-1">{p.description}</p>
            {p.rateInfo && <p className="xs muted">{p.rateInfo}</p>}
            <div className="row mt-1" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-sm" onClick={() => setApply(p)}>Ajukan</button>
              {p.contactUrl && <a className="btn btn-ghost btn-sm" href={p.contactUrl} target="_blank" rel="noreferrer noopener">Situs mitra</a>}
              {p.contactPhone && <span className="xs muted">{p.contactPhone}</span>}
            </div>
          </div>))}</div>)}

      <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Pengajuan saya</h2>
      {apps === null ? <Skeleton h={80} /> : apps.length === 0 ? <p className="sm muted">Belum ada pengajuan.</p> : (
        <div className="card"><div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>{apps.map((a) => (
          <div className="list-item" key={a.id} style={{ alignItems: "flex-start" }}>
            <div className="grow"><div style={{ fontWeight: 600 }}>{a.partner} · {rp(a.amount)} · {a.tenorMonths} bulan <span className="badge">{ST[a.status]}</span></div><div className="xs muted">{PURPOSE[a.purpose]} · {fmtDate(a.createdAt)}{a.partnerNote ? ` · Catatan mitra: ${a.partnerNote}` : ""}</div></div>
            {(a.status === "SUBMITTED" || a.status === "IN_REVIEW") && <button className="btn btn-ghost btn-sm" onClick={() => void withdraw(a.id)}>Tarik</button>}
          </div>))}</div></div>)}

      {apply && (
        <Modal title={`Ajukan ke ${apply.name}`} onClose={() => setApply(null)}>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget); }}>
            <div className="grid g2">
              <div className="field"><label htmlFor="fa">Jumlah (Rp)</label><input id="fa" name="amount" type="number" className="input" required min={apply.minAmount ?? 1} max={apply.maxAmount ?? undefined} inputMode="numeric" /></div>
              <div className="field"><label htmlFor="ft">Tenor (bulan)</label><input id="ft" name="tenor" type="number" className="input" required min={1} max={60} defaultValue={6} /></div>
            </div>
            <div className="field"><label htmlFor="fp">Tujuan</label><select id="fp" name="purpose" className="input">{Object.entries(PURPOSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field"><label htmlFor="fn">Keterangan (opsional)</label><input id="fn" name="note" className="input" maxLength={500} /></div>
            <p className="xs muted">Ringkasan keuangan 6 bulan di atas ikut dikirim ke mitra.</p>
            <button className="btn btn-primary" disabled={busy}>Kirim pengajuan</button>
          </form>
        </Modal>)}
    </main>
  );
}
