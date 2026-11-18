"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Empty, Modal, Skeleton, fmt, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

type Kind = "VACCINATION" | "TREATMENT" | "QUARANTINE";
interface Rec { id: string; batchId: string; kind: Kind; status: "PLANNED" | "ACTIVE" | "DONE"; title: string; medicine: string | null; dose: string | null; affectedCount: number | null; eventOn: string; doneOn: string | null; withdrawalUntil: string | null; cost: number | null; note: string | null; voidedAt: string | null }
interface Batch { id: string; code: string; status: string }

const TABS: { k: Kind; label: string; add: string; titleLabel: string; ph: string }[] = [
  { k: "VACCINATION", label: "Vaksinasi", add: "Jadwalkan vaksinasi", titleLabel: "Nama vaksin", ph: "contoh: ND-IB, Anthrax" },
  { k: "TREATMENT", label: "Pengobatan", add: "Catat pengobatan", titleLabel: "Diagnosa / keluhan", ph: "contoh: Diare, cacingan" },
  { k: "QUARANTINE", label: "Karantina", add: "Mulai karantina", titleLabel: "Alasan karantina", ph: "contoh: Ternak baru datang, dugaan penyakit" },
];
const STATUS = { PLANNED: "Terjadwal", ACTIVE: "Berjalan", DONE: "Selesai" } as const;
const today = () => new Date().toLocaleDateString("sv-SE");
const todayStr = today();
const day = (d: string) => d.slice(0, 10);

export default function KesehatanPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Kind>("VACCINATION");
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cfg = TABS.find((t) => t.k === tab)!;

  const load = useCallback(() => api<{ data: Rec[] }>("/health-records?limit=100").then((r) => setRows(r.data)).catch((e: Error) => { setErr(e.message); setRows([]); }), []);
  useEffect(() => { void load(); api<{ data: Batch[] }>("/batches?limit=100").then((r) => setBatches(r.data)).catch(() => undefined); }, [load]);

  const code = useMemo(() => new Map(batches.map((b) => [b.id, b.code])), [batches]);
  const list = (rows ?? []).filter((r) => r.kind === tab && !r.voidedAt)
    .sort((a, b) => (a.status === "DONE" ? 1 : 0) - (b.status === "DONE" ? 1 : 0) || (a.status === "DONE" ? day(b.eventOn).localeCompare(day(a.eventOn)) : day(a.eventOn).localeCompare(day(b.eventOn))));
  const open = (k: Kind) => (rows ?? []).filter((r) => r.kind === k && !r.voidedAt && r.status !== "DONE").length;

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast({ kind: "ok", title: ok }); await load(); } catch (e) { toast({ kind: "err", title: e instanceof ApiFailure ? e.message : "Gagal" }); }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(null);
    const f = new FormData(e.currentTarget);
    const num = (n: string) => (f.get(n) ? Number(f.get(n)) : undefined);
    const str = (n: string) => (String(f.get(n) ?? "").trim() || undefined);
    try {
      await api("/health-records", { body: { batchId: f.get("batchId"), kind: tab, title: f.get("title"), medicine: str("medicine"), dose: str("dose"), affectedCount: num("affectedCount"), eventOn: f.get("eventOn"), withdrawalUntil: str("withdrawalUntil"), cost: num("cost"), note: str("note"), clientId: crypto.randomUUID() } });
      setModal(false); toast({ kind: "ok", title: "Catatan kesehatan tersimpan" }); await load();
    } catch (x) { setErr(x instanceof ApiFailure ? (x.code === "VALIDATION_ERROR" ? "Periksa isian tanggal dan angka." : x.message) : "Gagal menyimpan"); } finally { setBusy(false); }
  }

  return (
    <main className="page">
      <div className="page-h"><div><h1>Kesehatan</h1><p>Jadwal vaksinasi, riwayat pengobatan, dan karantina ternak.</p></div><button className="btn btn-primary" onClick={() => { setErr(null); setModal(true); }}>{cfg.add}</button></div>
      <div className="seg" role="tablist" style={{ flexWrap: "wrap" }}>{TABS.map((t) => <button key={t.k} role="tab" aria-selected={tab === t.k} className={tab === t.k ? "on" : ""} onClick={() => setTab(t.k)} type="button">{t.label}{open(t.k) ? ` (${open(t.k)})` : ""}</button>)}</div>
      {err && !modal && <div className="alert err mt-2">{err}</div>}
      <div className="mt-3">
        {rows === null ? <Skeleton h={180} /> : list.length === 0 ? <Empty icon="heart" title={`Belum ada catatan ${cfg.label.toLowerCase()}`} text="Tambahkan catatan pertama lewat tombol di kanan atas." /> : (
          <div className="card">{list.map((r) => {
            const late = r.status === "PLANNED" && day(r.eventOn) < todayStr;
            const withdraw = r.withdrawalUntil && day(r.withdrawalUntil) >= todayStr;
            return (
              <div key={r.id} className="row" style={{ gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line, #e5e7eb)", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{r.title} <span className={`badge ${late ? "warn" : r.status === "DONE" ? "ok" : ""}`}>{late ? "Terlambat" : STATUS[r.status]}</span>{withdraw && <> <span className="badge warn">Masa henti s.d. {fmtDate(r.withdrawalUntil!)}</span></>}</div>
                  <div className="xs muted">{code.get(r.batchId) ?? "-"} · {r.status === "PLANNED" ? "Jadwal" : "Mulai"} {fmtDate(r.eventOn)}{r.doneOn ? ` · selesai ${fmtDate(r.doneOn)}` : ""}{r.affectedCount ? ` · ${fmt(r.affectedCount)} ekor` : ""}{r.medicine ? ` · ${r.medicine}` : ""}{r.dose ? ` (${r.dose})` : ""}{r.cost ? ` · Rp ${fmt(r.cost)}` : ""}</div>
                  {r.note && <div className="sm mt-1">{r.note}</div>}
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {r.status !== "DONE" && <button className="btn btn-secondary btn-sm" onClick={() => void act(() => api(`/health-records/${r.id}/complete`, { body: {} }), "Ditandai selesai")}>{r.kind === "VACCINATION" ? "Sudah divaksin" : "Selesai"}</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => { const reason = window.prompt("Alasan membatalkan catatan ini?"); if (reason) void act(() => api(`/health-records/${r.id}/void`, { body: { reason } }), "Catatan dibatalkan"); }}>Batalkan</button>
                </div>
              </div>);
          })}</div>
        )}
      </div>
      {modal && (
        <Modal title={cfg.add} onClose={() => setModal(false)}>
          <form onSubmit={(e) => void create(e)} className="stack" key={tab}>
            <div className="field"><label htmlFor="batchId">Batch</label><select id="batchId" name="batchId" className="input" required defaultValue=""><option value="" disabled>Pilih batch</option>{batches.filter((b) => b.status === "ACTIVE").map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select></div>
            <div className="field"><label htmlFor="title">{cfg.titleLabel}</label><input id="title" name="title" className="input" required maxLength={160} placeholder={cfg.ph} /></div>
            <div className="grid g2">
              <div className="field"><label htmlFor="eventOn">{tab === "VACCINATION" ? "Tanggal jadwal" : "Tanggal mulai"}</label><input id="eventOn" name="eventOn" type="date" className="input" defaultValue={today()} {...(tab === "VACCINATION" ? {} : { max: today() })} required /></div>
              <div className="field"><label htmlFor="affectedCount">Jumlah ekor</label><input id="affectedCount" name="affectedCount" type="number" min="1" inputMode="numeric" className="input" placeholder="opsional" /></div>
            </div>
            {tab !== "QUARANTINE" && (
              <div className="grid g2">
                <div className="field"><label htmlFor="medicine">{tab === "VACCINATION" ? "Merek / batch vaksin" : "Obat"}</label><input id="medicine" name="medicine" className="input" maxLength={120} placeholder="opsional" /></div>
                <div className="field"><label htmlFor="dose">Dosis</label><input id="dose" name="dose" className="input" maxLength={120} placeholder="opsional" /></div>
              </div>)}
            {tab === "TREATMENT" && <div className="field"><label htmlFor="withdrawalUntil">Masa henti obat sampai</label><input id="withdrawalUntil" name="withdrawalUntil" type="date" className="input" /><span className="hint">Ternak atau hasilnya belum boleh dijual/dikonsumsi sampai tanggal ini.</span></div>}
            {tab !== "QUARANTINE" && <div className="field"><label htmlFor="cost">Biaya (Rp)</label><input id="cost" name="cost" type="number" min="0" inputMode="numeric" className="input" placeholder="opsional" /></div>}
            <div className="field"><label htmlFor="note">Catatan</label><input id="note" name="note" className="input" maxLength={500} placeholder="opsional" /></div>
            {err && <div className="alert err" role="alert">{err}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
          </form>
        </Modal>
      )}
    </main>
  );
}
