"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Columns, HBars } from "@/components/charts";
import { useMe } from "@/components/app-shell";
import { Empty, Modal, Skeleton, fmt, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

interface Summary { month: string; income: number; expense: number; profit: number; incomeBy: Record<string, number>; expenseBy: Record<string, number>; cashflow: { month: string; income: number; expense: number }[]; budget: { category: string; budget: number; actual: number }[]; receivables: { total: number; count: number; overdue: number; overdueCount: number } }
interface Entry { id: string; kind: "INCOME" | "EXPENSE"; category: string; amount: number; occurredOn: string; batchId: string | null; description: string | null; voidedAt: string | null; invoiceId: string | null }
interface Pnl { id: string; code: string; status: string; initialCount: number; revenue: number; feed: number; health: number; other: number; cost: number; profit: number; hppPerHead: number }
interface Invoice { id: string; number: string; customerName: string; issueOn: string; dueOn: string; amount: number; status: "OPEN" | "PAID" | "VOID"; paidOn: string | null }
interface Batch { id: string; code: string }
type Tab = "ringkasan" | "transaksi" | "pnl" | "anggaran" | "invoice";

const CAT: Record<string, string> = { PAKAN: "Pakan", KESEHATAN: "Kesehatan", BIBIT: "Bibit / DOC", TENAGA_KERJA: "Tenaga kerja", LISTRIK_AIR: "Listrik & air", TRANSPORT: "Transportasi", PERALATAN: "Peralatan", SEWA: "Sewa", LAINNYA: "Lainnya", PENJUALAN_TERNAK: "Penjualan ternak", PENJUALAN_HASIL: "Penjualan hasil ternak" };
const EXPENSE = ["BIBIT", "TENAGA_KERJA", "LISTRIK_AIR", "TRANSPORT", "PERALATAN", "SEWA", "LAINNYA"];
const INCOME = ["PENJUALAN_TERNAK", "PENJUALAN_HASIL", "LAINNYA"];
const BUDGET = ["PAKAN", "KESEHATAN", ...EXPENSE];
const rp = (n: number) => `${n < 0 ? "-" : ""}Rp ${fmt(Math.round(Math.abs(n)))}`;
const nowMonth = () => new Date().toLocaleDateString("sv-SE").slice(0, 7);
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const monLabel = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;

export default function KeuanganPage() {
  const me = useMe();
  const toast = useToast();
  const role = me?.organizations.find((o) => o.id === me.activeOrganizationId)?.role;
  const allowed = role === "OWNER" || role === "MANAGER";
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [month, setMonth] = useState(nowMonth());
  const [sum, setSum] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [pnl, setPnl] = useState<Pnl[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [modal, setModal] = useState<null | "entry" | "invoice">(null);
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!allowed) return;
    const fail = (e: Error) => setLoadErr(e.message);
    api<{ data: Summary }>(`/finance/summary?month=${month}`).then((r) => setSum(r.data)).catch(fail);
    api<{ data: Entry[] }>("/finance/entries?limit=100").then((r) => setEntries(r.data)).catch(fail);
    api<{ data: Pnl[] }>("/finance/pnl").then((r) => setPnl(r.data)).catch(fail);
    api<{ data: Invoice[] }>("/finance/invoices").then((r) => setInvoices(r.data)).catch(fail);
  }, [allowed, month]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api<{ data: Batch[] }>("/batches?limit=100").then((r) => setBatches(r.data)).catch(() => undefined); }, []);

  if (me && !allowed) return <main className="page"><Empty icon="coin" title="Keuangan hanya untuk pemilik dan manajer" text="Minta pemilik usaha untuk mengubah perananmu kalau butuh akses." /></main>;

  async function run(fn: () => Promise<unknown>, ok: string, close = true) {
    setBusy(true); setErr(null);
    try { await fn(); if (close) setModal(null); toast({ kind: "ok", title: ok }); load(); }
    catch (x) { const m = x instanceof ApiFailure ? (x.code === "VALIDATION_ERROR" ? "Periksa isian tanggal dan angka." : x.code === "FORBIDDEN" ? x.message : x.message) : "Gagal"; if (close) setErr(m); else toast({ kind: "err", title: m }); }
    finally { setBusy(false); }
  }
  const code = new Map(batches.map((b) => [b.id, b.code]));
  const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || undefined;

  const addEntry = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => api("/finance/entries", { body: { kind, category: f.get("category"), amount: Number(f.get("amount")), occurredOn: f.get("date"), batchId: str(f, "batchId"), description: str(f, "description"), clientId: crypto.randomUUID() } }), "Transaksi tersimpan"); };
  const addInvoice = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => api("/finance/invoices", { body: { customerName: f.get("customer"), customerContact: str(f, "contact"), batchId: str(f, "batchId"), issueOn: f.get("issueOn"), dueOn: f.get("dueOn"), description: str(f, "description"), amount: Number(f.get("amount")) } }), "Invoice dibuat"); };
  const saveBudget = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const items = BUDGET.filter((c) => str(f, c)).map((c) => ({ category: c, amount: Number(f.get(c)) })); if (items.length === 0) return; void run(() => api("/finance/budgets", { method: "PUT", body: { month, items } }), "Anggaran disimpan", false); };

  const TABS: [Tab, string][] = [["ringkasan", "Ringkasan"], ["transaksi", "Transaksi"], ["pnl", "Laba-rugi batch"], ["anggaran", "Anggaran"], ["invoice", `Invoice${sum?.receivables.overdueCount ? ` (${sum.receivables.overdueCount} lewat tempo)` : ""}`]];
  const today = new Date().toLocaleDateString("sv-SE");
  const budgetMap = new Map((sum?.budget ?? []).map((b) => [b.category, b.budget]));

  return (
    <main className="page">
      <div className="page-h"><div><h1>Keuangan</h1><p>Pemasukan, pengeluaran, laba-rugi, dan piutang usaha ternakmu. Biaya pakan dan obat terhitung otomatis dari catatan di menu masing-masing.</p></div>
        <div className="row" style={{ gap: 8 }}><input type="month" className="input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Bulan" style={{ width: "auto" }} /><button className="btn btn-primary" onClick={() => { setErr(null); setKind("INCOME"); setModal("entry"); }}>Catat transaksi</button></div></div>
      {loadErr && <div className="alert err">{loadErr}</div>}
      <div className="seg" role="tablist" style={{ flexWrap: "wrap" }}>{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} type="button">{l}</button>)}</div>

      {tab === "ringkasan" && <div className="mt-3">{!sum ? <Skeleton h={220} /> : (<>
        <div className="grid g4">
          <div className="card kpi"><div className="kpi-top">Pemasukan</div><div className="kpi-v" style={{ fontSize: 24 }}>{rp(sum.income)}</div></div>
          <div className="card kpi"><div className="kpi-top">Pengeluaran</div><div className="kpi-v" style={{ fontSize: 24 }}>{rp(sum.expense)}</div></div>
          <div className="card kpi"><div className="kpi-top">Laba / rugi</div><div className="kpi-v" style={{ fontSize: 24, color: sum.profit < 0 ? "var(--danger, #c0392b)" : undefined }}>{rp(sum.profit)}</div></div>
          <div className="card kpi"><div className="kpi-top">Piutang terbuka</div><div className="kpi-v" style={{ fontSize: 24 }}>{rp(sum.receivables.total)}</div><div className="kpi-s">{sum.receivables.overdueCount ? `${rp(sum.receivables.overdue)} lewat tempo` : `${sum.receivables.count} invoice`}</div></div>
        </div>
        <div className="grid g2 mt-2">
          <div className="card"><div className="card-h"><h3>Pemasukan 6 bulan</h3></div><div className="card-b"><Columns labels={sum.cashflow.map((m) => monLabel(m.month))} values={sum.cashflow.map((m) => m.income)} /></div></div>
          <div className="card"><div className="card-h"><h3>Pengeluaran 6 bulan</h3></div><div className="card-b"><Columns tone="red" labels={sum.cashflow.map((m) => monLabel(m.month))} values={sum.cashflow.map((m) => m.expense)} /></div></div>
        </div>
        <div className="card mt-2"><div className="card-h"><h3>Pengeluaran per kategori ({monLabel(sum.month)})</h3></div><div className="card-b">
          {Object.keys(sum.expenseBy).length === 0 ? <Empty icon="coin" title="Belum ada pengeluaran bulan ini" /> : <HBars items={Object.entries(sum.expenseBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: CAT[k] ?? k, value: Math.round(v) }))} />}</div></div>
      </>)}</div>}

      {tab === "transaksi" && <div className="mt-3">{!entries ? <Skeleton h={180} /> : entries.length === 0 ? <Empty icon="coin" title="Belum ada transaksi" text="Catat penjualan atau pengeluaran pertamamu." /> : (
        <div className="card table-wrap"><table className="table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th className="num">Jumlah</th><th /></tr></thead><tbody>
          {entries.filter((e) => !e.voidedAt).map((e) => (<tr key={e.id}><td>{fmtDate(e.occurredOn)}</td><td>{CAT[e.category] ?? e.category}{e.batchId ? <div className="xs muted">{code.get(e.batchId)}</div> : null}</td><td className="muted">{e.description ?? ""}</td>
            <td className="num" style={{ color: e.kind === "INCOME" ? "var(--ok, #1e7e34)" : undefined }}>{e.kind === "INCOME" ? "+" : "-"}{rp(e.amount)}</td>
            <td className="tr">{!e.invoiceId && <button className="btn btn-ghost btn-sm" onClick={() => { const reason = window.prompt("Alasan membatalkan transaksi ini?"); if (reason) void run(() => api(`/finance/entries/${e.id}/void`, { body: { reason } }), "Transaksi dibatalkan", false); }}>Batalkan</button>}</td></tr>))}</tbody></table></div>)}</div>}

      {tab === "pnl" && <div className="mt-3">{!pnl ? <Skeleton h={180} /> : pnl.length === 0 ? <Empty icon="chart" title="Belum ada batch" /> : (
        <div className="card table-wrap"><table className="table"><thead><tr><th>Batch</th><th className="num">Pendapatan</th><th className="num">Pakan</th><th className="num">Kesehatan</th><th className="num">Lainnya</th><th className="num">Laba</th><th className="num">HPP/ekor</th></tr></thead><tbody>
          {pnl.map((b) => (<tr key={b.id}><td>{b.code}<div className="xs muted">{b.status === "ACTIVE" ? "Aktif" : "Ditutup"}</div></td><td className="num">{rp(b.revenue)}</td><td className="num">{rp(b.feed)}</td><td className="num">{rp(b.health)}</td><td className="num">{rp(b.other)}</td><td className="num" style={{ fontWeight: 700, color: b.profit < 0 ? "var(--danger, #c0392b)" : undefined }}>{rp(b.profit)}</td><td className="num">{b.cost > 0 ? rp(b.hppPerHead) : "-"}</td></tr>))}</tbody></table>
          <p className="xs muted" style={{ padding: "8px 16px" }}>HPP per ekor = total biaya ÷ populasi awal batch. Pendapatan dan pengeluaran lain dihitung dari transaksi yang ditandai batch.</p></div>)}</div>}

      {tab === "anggaran" && <div className="mt-3"><form className="card card-pad" onSubmit={saveBudget} key={month + (sum?.budget.length ?? 0)}>
        <h3>Anggaran {monLabel(month)}</h3><p className="muted sm">Isi batas pengeluaran per kategori. Kosongkan kategori yang tidak dianggarkan.</p>
        <div className="grid g2 mt-2">{BUDGET.map((c) => { const b = sum?.budget.find((x) => x.category === c); return (
          <div className="field" key={c}><label htmlFor={`b-${c}`}>{CAT[c]}{b ? <span className="muted xs"> · terpakai {rp(b.actual)}{b.budget > 0 ? ` (${Math.round((b.actual / b.budget) * 100)}%)` : ""}</span> : null}</label>
            <input id={`b-${c}`} name={c} type="number" min="0" inputMode="numeric" className="input" defaultValue={budgetMap.get(c) ?? ""} placeholder="Rp" style={b && b.budget > 0 && b.actual > b.budget ? { borderColor: "var(--danger, #c0392b)" } : undefined} /></div>); })}</div>
        <button className="btn btn-primary mt-2" disabled={busy}>Simpan anggaran</button></form></div>}

      {tab === "invoice" && <div className="mt-3">
        <div className="row" style={{ justifyContent: "flex-end", marginBottom: 8 }}><button className="btn btn-primary" onClick={() => { setErr(null); setModal("invoice"); }}>Buat invoice</button></div>
        {!invoices ? <Skeleton h={160} /> : invoices.length === 0 ? <Empty icon="coin" title="Belum ada invoice" text="Buat invoice untuk pembeli yang membayar belakangan." /> : (
          <div className="card table-wrap"><table className="table"><thead><tr><th>Nomor</th><th>Pelanggan</th><th>Jatuh tempo</th><th className="num">Jumlah</th><th>Status</th><th /></tr></thead><tbody>
            {invoices.map((i) => { const late = i.status === "OPEN" && i.dueOn.slice(0, 10) < today; return (
              <tr key={i.id} style={i.status === "VOID" ? { opacity: .55 } : undefined}><td><Link href={`/app/keuangan/invoice/${i.id}`}>{i.number}</Link></td><td>{i.customerName}</td><td>{fmtDate(i.dueOn)}</td><td className="num">{rp(i.amount)}</td><td><span className={`badge ${late ? "warn" : i.status === "PAID" ? "ok" : ""}`}>{late ? "Lewat tempo" : i.status === "OPEN" ? "Belum lunas" : i.status === "PAID" ? "Lunas" : "Dibatalkan"}</span></td>
                <td className="tr">{i.status === "OPEN" && <button className="btn btn-secondary btn-sm" onClick={() => void run(() => api(`/finance/invoices/${i.id}/pay`, { body: {} }), "Invoice lunas dan pemasukan tercatat", false)}>Tandai lunas</button>}{i.status !== "VOID" && <button className="btn btn-ghost btn-sm" onClick={() => { const reason = window.prompt("Alasan membatalkan invoice ini?"); if (reason) void run(() => api(`/finance/invoices/${i.id}/void`, { body: { reason } }), "Invoice dibatalkan", false); }}>Batalkan</button>}</td></tr>); })}</tbody></table></div>)}
      </div>}

      {modal === "entry" && (<Modal title="Catat transaksi" onClose={() => setModal(null)}><form onSubmit={addEntry} className="stack" key={kind}>
        <div className="seg" role="tablist"><button type="button" className={kind === "INCOME" ? "on" : ""} onClick={() => setKind("INCOME")}>Pemasukan</button><button type="button" className={kind === "EXPENSE" ? "on" : ""} onClick={() => setKind("EXPENSE")}>Pengeluaran</button></div>
        {kind === "EXPENSE" && <p className="xs muted">Pakan dan obat tidak perlu dicatat di sini, sudah terhitung otomatis dari menu Pakan dan Kesehatan (isi kolom biaya di sana).</p>}
        <div className="grid g2"><div className="field"><label htmlFor="category">Kategori</label><select id="category" name="category" className="input">{(kind === "INCOME" ? INCOME : EXPENSE).map((c) => <option key={c} value={c}>{CAT[c]}</option>)}</select></div>
          <div className="field"><label htmlFor="amount">Jumlah (Rp)</label><input id="amount" name="amount" type="number" min="1" inputMode="numeric" className="input" required /></div></div>
        <div className="grid g2"><div className="field"><label htmlFor="date">Tanggal</label><input id="date" name="date" type="date" className="input" defaultValue={today} max={today} required /></div>
          <div className="field"><label htmlFor="batchId">Batch (opsional)</label><select id="batchId" name="batchId" className="input" defaultValue=""><option value="">Umum / tidak spesifik</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select></div></div>
        <div className="field"><label htmlFor="description">Keterangan</label><input id="description" name="description" className="input" maxLength={300} placeholder="opsional" /></div>
        {err && <div className="alert err">{err}</div>}<button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button></form></Modal>)}

      {modal === "invoice" && (<Modal title="Buat invoice" onClose={() => setModal(null)}><form onSubmit={addInvoice} className="stack">
        <div className="field"><label htmlFor="customer">Nama pelanggan</label><input id="customer" name="customer" className="input" required minLength={2} maxLength={120} /></div>
        <div className="field"><label htmlFor="contact">Kontak</label><input id="contact" name="contact" className="input" maxLength={120} placeholder="opsional" /></div>
        <div className="grid g2"><div className="field"><label htmlFor="issueOn">Tanggal terbit</label><input id="issueOn" name="issueOn" type="date" className="input" defaultValue={today} required /></div><div className="field"><label htmlFor="dueOn">Jatuh tempo</label><input id="dueOn" name="dueOn" type="date" className="input" defaultValue={today} required /></div></div>
        <div className="grid g2"><div className="field"><label htmlFor="iamount">Jumlah (Rp)</label><input id="iamount" name="amount" type="number" min="1" inputMode="numeric" className="input" required /></div><div className="field"><label htmlFor="ibatch">Batch (opsional)</label><select id="ibatch" name="batchId" className="input" defaultValue=""><option value="">Tidak spesifik</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select></div></div>
        <div className="field"><label htmlFor="idesc">Keterangan barang</label><input id="idesc" name="description" className="input" maxLength={500} placeholder="contoh: 20 ekor ayam broiler @ Rp 45.000" /></div>
        {err && <div className="alert err">{err}</div>}<button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Membuat…" : "Buat invoice"}</button></form></Modal>)}
    </main>
  );
}
