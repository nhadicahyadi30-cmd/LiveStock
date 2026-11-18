"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Empty, Spinner, fmt, useToast } from "@/components/ui";
import { api, ApiFailure, NetworkFailure } from "@/lib/api";
import { discard, enqueue, flushQueue, readQueue, type QueuedRecord } from "@/lib/offline-queue";

interface Batch { id: string; code: string; currentCount: number }
type Kind = "weight" | "mortality";
const today = () => new Date().toISOString().slice(0, 10);
const CAUSES: [string, string][] = [["UNKNOWN", "Tidak diketahui"], ["DISEASE", "Penyakit"], ["INJURY", "Cedera"], ["PREDATION", "Predator"], ["ENVIRONMENT", "Lingkungan"], ["OTHER", "Lainnya"]];

function RecordForm() {
  const params = useSearchParams();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>(params.get("jenis") === "mortality" ? "mortality" : "weight");
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [queue, setQueue] = useState<QueuedRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => setQueue(readQueue()), []);
  useEffect(() => { api<{ data: Batch[] }>("/batches?status=ACTIVE").then((r) => setBatches(r.data)).catch(() => setBatches([])); refresh(); }, [refresh]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const clientId = crypto.randomUUID(); // dibuat sebelum kirim: percobaan ulang tidak menggandakan data
    const batchId = String(f.get("batchId"));
    const path = kind === "weight" ? "/weight-records" : "/mortality-records";
    const body: Record<string, unknown> = kind === "weight"
      ? { batchId, clientId, measuredOn: f.get("date"), weightKg: Number(f.get("weightKg")), sampleSize: f.get("sampleSize") ? Number(f.get("sampleSize")) : undefined }
      : { batchId, clientId, occurredOn: f.get("date"), count: Number(f.get("count")), cause: f.get("cause"), note: f.get("note") || undefined };

    setBusy(true); setErr(null);
    try {
      await api(path, { body });
      toast({ kind: "ok", title: "Catatan tersimpan", text: kind === "weight" ? "Bobot berhasil dicatat." : "Kematian berhasil dicatat." });
      form.reset();
      api<{ data: Batch[] }>("/batches?status=ACTIVE").then((r) => setBatches(r.data)).catch(() => undefined);
    } catch (error) {
      if (error instanceof NetworkFailure) {
        try {
          enqueue(path as QueuedRecord["path"], body);
          toast({ kind: "warn", title: "Disimpan di perangkat", text: "Tidak ada koneksi. Akan dikirim otomatis saat online." });
          form.reset(); refresh();
        } catch (qe) { setErr((qe as Error).message); }
      } else if (error instanceof ApiFailure && error.code === "VALIDATION_ERROR") setErr("Data belum valid. Periksa angka dan tanggal.");
      else if (error instanceof ApiFailure && error.code === "BATCH_CLOSED") setErr("Batch ini sudah ditutup.");
      else if (error instanceof ApiFailure && error.status === 403) setErr("Role Anda tidak boleh membuat catatan.");
      else setErr(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally { setBusy(false); }
  }

  async function retry() { const r = await flushQueue(); refresh(); toast({ kind: r.sent ? "ok" : "warn", title: r.sent ? `${r.sent} catatan terkirim` : "Belum ada yang terkirim", text: r.remaining ? `${r.remaining} masih menunggu.` : undefined }); }

  return (
    <main className="page">
      <div className="page-h"><div><h1>Catat</h1><p>Catat bobot atau kematian dalam hitungan detik. Tetap bisa dipakai tanpa internet.</p></div></div>
      <div className="grid g-main">
        <div className="card">
          <div className="card-h">
            <div className="seg" role="tablist">
              <button role="tab" aria-selected={kind === "weight"} className={kind === "weight" ? "on" : ""} onClick={() => setKind("weight")} type="button">Bobot</button>
              <button role="tab" aria-selected={kind === "mortality"} className={kind === "mortality" ? "on" : ""} onClick={() => setKind("mortality")} type="button">Kematian</button>
            </div>
          </div>
          <form className="card-b" onSubmit={onSubmit} key={kind}>
            {err && <div className="alert err" role="alert"><Icon name="alert" /> {err}</div>}
            {batches && batches.length === 0 && <div className="alert info"><Icon name="info" /> Belum ada batch aktif. Tambahkan batch di tab Ternak dulu.</div>}
            <div className="field"><label htmlFor="batchId">Batch</label>
              <select id="batchId" name="batchId" className="input" required defaultValue="">
                <option value="" disabled>Pilih batch</option>
                {(batches ?? []).map((b) => <option key={b.id} value={b.id}>{b.code} · {fmt(b.currentCount)} ekor</option>)}
              </select></div>
            <div className="field"><label htmlFor="date">Tanggal</label><input id="date" name="date" type="date" className="input" defaultValue={today()} max={today()} required /></div>
            {kind === "weight" ? (
              <div className="grid g2">
                <div className="field"><label htmlFor="weightKg">Bobot rata-rata (kg)</label><input id="weightKg" name="weightKg" type="number" inputMode="decimal" step="0.001" min="0.001" className="input" required /></div>
                <div className="field"><label htmlFor="sampleSize">Jumlah sampel</label><input id="sampleSize" name="sampleSize" type="number" inputMode="numeric" min="1" className="input" placeholder="opsional" /></div>
              </div>
            ) : (<>
              <div className="grid g2">
                <div className="field"><label htmlFor="count">Jumlah ekor</label><input id="count" name="count" type="number" inputMode="numeric" min="1" defaultValue="1" className="input" required /></div>
                <div className="field"><label htmlFor="cause">Penyebab</label><select id="cause" name="cause" className="input" defaultValue="UNKNOWN">{CAUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              </div>
              <div className="field"><label htmlFor="note">Catatan</label><input id="note" name="note" className="input" maxLength={500} placeholder="opsional" /></div>
            </>)}
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <><Spinner /> Menyimpan…</> : "Simpan catatan"}</button>
          </form>
        </div>

        <div className="card">
          <div className="card-h"><h3>Menunggu dikirim</h3>{queue.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => void retry()}>Kirim sekarang</button>}</div>
          <div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {queue.length === 0 ? <Empty icon="check" title="Semua terkirim" text="Catatan yang dibuat saat offline akan muncul di sini." /> : queue.map((q) => (
              <div className="list-item" key={q.clientId}>
                <span className={`dot-ic ${q.error ? "red" : ""}`}><Icon name={q.error ? "alert" : "wifiOff"} size={18} /></span>
                <div className="grow"><div style={{ fontWeight: 600 }}>{q.path === "/weight-records" ? "Bobot" : "Kematian"}</div><div className="xs muted">{q.error ?? new Date(q.queuedAt).toLocaleString("id-ID")}</div></div>
                {q.error && <button className="icon-btn" aria-label="Buang" onClick={() => { discard(q.clientId); refresh(); }}><Icon name="trash" size={18} /></button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function RecordPage() { return <Suspense><RecordForm /></Suspense>; }
