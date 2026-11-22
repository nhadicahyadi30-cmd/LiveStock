"use client";
import { useCallback, useEffect, useState } from "react";
import { Skeleton, fmtDate, useToast } from "@/components/ui";
import { api } from "@/lib/api";

type Limits = { farms: number | null; members: number | null; devices: number | null };
interface Plan { id: string; name: string; priceMonthly: number; limits: Limits; highlights: string[] }
interface Inv { id: string; number: string; plan: string; months: number; amount: number; status: string; dueOn: string }
interface Data { plan: string; storedPlan: string; expiresAt: string | null; usage: Limits & { farms: number; members: number; devices: number }; limits: Limits; plans: Plan[]; invoices: Inv[]; paymentInfo: string | null; canManage: boolean }

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const RES: [keyof Limits, string][] = [["farms", "Farm"], ["members", "Anggota (termasuk undangan)"], ["devices", "Perangkat IoT"]];
const ST: Record<string, string> = { PENDING: "Menunggu pembayaran", PAID: "Lunas", VOID: "Dibatalkan" };

export default function LanggananPage() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [months, setMonths] = useState<1 | 3 | 6 | 12>(1);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<{ data: Data }>("/billing").then((r) => setD(r.data)).catch((e: Error) => toast({ kind: "err", title: e.message })); }, [toast]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast({ kind: "ok", title: ok }); load(); } catch (e) { toast({ kind: "err", title: (e as Error).message }); } finally { setBusy(false); }
  }

  if (!d) return <main className="page"><Skeleton h={260} /></main>;
  const cur = d.plans.find((p) => p.id === d.plan);
  return (
    <main className="page">
      <div className="page-h"><div><h1>Langganan</h1><p>Paket aktif, pemakaian, dan tagihan.</p></div></div>
      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h3>Paket {cur?.name ?? d.plan}</h3>
          <span className="xs muted">{d.expiresAt && d.plan !== "FREE" ? `Aktif sampai ${fmtDate(d.expiresAt)}` : d.storedPlan !== "FREE" && d.plan === "FREE" ? "Paket berbayar sudah berakhir" : ""}</span>
        </div>
        <div className="stack mt-1">
          {RES.map(([k, label]) => { const lim = d.limits[k]; const used = d.usage[k]; const pct = lim ? Math.min(100, Math.round((used / lim) * 100)) : 0; return (
            <div key={k}><div className="row sm" style={{ justifyContent: "space-between" }}><span>{label}</span><b>{used}{lim ? ` / ${lim}` : " (tanpa batas)"}</b></div>
              {lim ? <div style={{ height: 6, background: "var(--surface-2, #eee)", borderRadius: 3 }}><div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: pct >= 100 ? "var(--danger, #c0392b)" : "var(--brand, #1f9d55)" }} /></div> : null}</div>); })}
        </div>
      </div>

      <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Pilih paket</h2>
      <div className="row sm" style={{ gap: 8, marginBottom: 8 }}><label htmlFor="mo">Lama langganan</label>
        <select id="mo" className="input" style={{ width: "auto" }} value={months} onChange={(e) => setMonths(Number(e.target.value) as 1 | 3 | 6 | 12)}>{[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} bulan</option>)}</select></div>
      <div className="grid g2">{d.plans.map((p) => (
        <div className="card card-pad" key={p.id}>
          <div className="row" style={{ justifyContent: "space-between" }}><h3>{p.name}</h3>{p.id === d.plan && <span className="badge ok">Aktif</span>}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{p.id === "ENTERPRISE" ? "Hubungi kami" : p.priceMonthly === 0 ? "Gratis" : `${rp(p.priceMonthly)}/bulan`}</div>
          <ul className="sm muted" style={{ paddingLeft: 18 }}>
            <li>{p.limits.farms ?? "Tanpa batas"} farm · {p.limits.members ?? "tanpa batas"} anggota · {p.limits.devices ?? "tanpa batas"} perangkat</li>
            {p.highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
          {["STARTER", "PRO", "BUSINESS"].includes(p.id) && <button className="btn btn-primary btn-sm" disabled={busy || !d.canManage} title={d.canManage ? undefined : "Hanya pemilik yang bisa memesan"} onClick={() => void run(() => api("/billing/checkout", { body: { plan: p.id, months } }), `Tagihan ${p.name} dibuat`)}>Pesan {months} bulan · {rp(p.priceMonthly * months)}</button>}
        </div>))}</div>
      {!d.canManage && <p className="xs muted mt-1">Hanya pemilik organisasi yang bisa memesan paket.</p>}

      <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Tagihan</h2>
      {d.invoices.some((i) => i.status === "PENDING") && <div className="alert info" style={{ marginBottom: 12 }}>{d.paymentInfo ?? "Hubungi pengelola platform untuk cara pembayaran."} Sertakan nomor tagihan saat transfer. Paket aktif setelah pembayaran dikonfirmasi pengelola.</div>}
      {d.invoices.length === 0 ? <p className="sm muted">Belum ada tagihan.</p> : (
        <div className="card"><div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>{d.invoices.map((i) => (
          <div className="list-item" key={i.id}>
            <div className="grow"><div style={{ fontWeight: 600 }}>{i.number} · {i.plan} {i.months} bulan · {rp(i.amount)} <span className="badge">{ST[i.status]}</span></div><div className="xs muted">Jatuh tempo {fmtDate(i.dueOn)}</div></div>
            {i.status === "PENDING" && d.canManage && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(() => api(`/billing/invoices/${i.id}/void`, { body: {} }), "Tagihan dibatalkan")}>Batalkan</button>}
          </div>))}</div></div>)}
    </main>
  );
}
