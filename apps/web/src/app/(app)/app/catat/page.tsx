"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Empty, Spinner, fmt, useToast } from "@/components/ui";
import { api, ApiFailure, NetworkFailure } from "@/lib/api";
import { discard, enqueue, flushQueue, readQueue, type QueuedRecord } from "@/lib/offline-queue";

interface Batch { id: string; code: string; currentCount: number }
type Kind = "weight" | "mortality" | "feed" | "production";
const KINDS: Kind[] = ["weight", "mortality", "feed", "production"];
const PATH: Record<Kind, QueuedRecord["path"]> = { weight: "/weight-records", mortality: "/mortality-records", feed: "/feed-records", production: "/production-records" };
const LABEL: Record<QueuedRecord["path"], string> = { "/weight-records": "Bobot", "/mortality-records": "Kematian", "/feed-records": "Pakan", "/production-records": "Produksi" };
const TAB: Record<Kind, string> = { weight: "Bobot", mortality: "Kematian", feed: "Pakan", production: "Produksi" };
const SAVED: Record<Kind, string> = { weight: "Bobot berhasil dicatat.", mortality: "Kematian berhasil dicatat.", feed: "Pakan berhasil dicatat.", production: "Produksi berhasil dicatat." };
const today = () => new Date().toISOString().slice(0, 10);
const CAUSES: [string, string][] = [["UNKNOWN", "Tidak diketahui"], ["DISEASE", "Penyakit"], ["INJURY", "Cedera"], ["PREDATION", "Predator"], ["ENVIRONMENT", "Lingkungan"], ["OTHER", "Lainnya"]];

function RecordForm() {
  const params = useSearchParams();
  const toast = useToast();
  const jenis = params.get("jenis");
  const [kind, setKind] = useState<Kind>(KINDS.includes(jenis as Kind) ? (jenis as Kind) : "weight");
  const [feedNames, setFeedNames] = useState<string[]>([]);
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [queue, setQueue] = useState<QueuedRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => setQueue(readQueue()), []);
  useEffect(() => { api<{ data: Batch[] }>("/batches?status=ACTIVE").then((r) => setBatches(r.data)).catch(() => setBatches([])); refresh(); api<{ data: { name: string }[] }>("/feed-types").then((r) => setFeedNames(r.data.map((t) => t.name))).catch(() => undefined); }, [refresh]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const clientId = crypto.randomUUID(); // dibuat sebelum kirim: percobaan ulang tidak menggandakan data
    const batchId = String(f.get("batchId"));
    const path = PATH[kind];
    const bodies: Record<Kind, Record<string, unknown>> = {
      weight: { batchId, clientId, measuredOn: f.get("date"), weightKg: Number(f.get("weightKg")), sampleSize: f.get("sampleSize") ? Number(f.get("sampleSize")) : undefined },
      mortality: { batchId, clientId, occurredOn: f.get("date"), count: Number(f.get("count")), cause: f.get("cause"), note: f.get("note") || undefined },
      feed: { batchId, clientId, givenOn: f.get("date"), feedName: f.get("feedName"), quantityKg: Number(f.get("quantityKg")), costTotal: f.get("costTotal") ? Number(f.get("costTotal")) : undefined, note: f.get("note") || undefined },
      production: { batchId, clientId, producedOn: f.get("date"), kind: f.get("prodKind"), quantity: Number(f.get("quantity")), note: f.get("note") || undefined },
    };
    const body = bodies[kind];

    setBusy(true); setErr(null);
    try {
      await api(path, { body });
      toast({ kind: "ok", title: "Catatan tersimpan", text: SAVED[kind] });
      form.reset();
      api<{ data: Batch[] }>("/batches?status=ACTIVE").then((r) => setBatches(r.data)).catch(() => undefined);
    } catch (error) {
      if (error instanceof NetworkFailure) {
        try {
          enqueue(path, body);
          toast({ kind: "warn", title: "Disimpan di perangkat", text: "Tidak ada koneksi. Akan dikirim otomatis saat online." });
          form.reset(); refresh();
        } catch (qe) { setErr((qe as Error).message); }
      } else if (error instanceof ApiFailure && error.code === "VALIDATION_ERROR") setErr("Data belum valid. Periksa angka dan tanggal.");
      else if (error instanceof ApiFailure && error.code === "BATCH_CLOSED") setErr("Batch ini sudah ditutup.");
      else if (error instanceof ApiFailure && error.code === "POPULATION_NEGATIVE") setErr(error.message);
      else if (error instanceof ApiFailure && error.status === 403) setErr("Role Anda tidak boleh membuat catatan.");
      else setErr(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally { setBusy(false); }
  }

  async function retry() { const r = await flushQueue(); refresh(); toast({ kind: r.sent ? "ok" : "warn", title: r.sent ? `${r.sent} catatan terkirim` : "Belum ada yang terkirim", text: r.remaining ? `${r.remaining} masih menunggu.` : undefined }); }

  return (
    <main className="page">
      <div className="page-h"><div><h1>Catat</h1><p>Catat bobot, kematian, pakan, atau produksi dalam hitungan detik. Tetap bisa dipakai tanpa internet.</p></div></div>
      <div className="grid g-main">
        <div className="card">
          <div className="card-h">
            <div className="seg" role="tablist" style={{ flexWrap: "wrap" }}>
              {KINDS.map((k) => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)} type="button">{TAB[k]}</button>)}
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
            {kind === "weight" && (
              <div className="grid g2">
                <div className="field"><label htmlFor="weightKg">Bobot rata-rata (kg)</label><input id="weightKg" name="weightKg" type="number" inputMode="decimal" step="0.001" min="0.001" className="input" required /></div>
                <div className="field"><label htmlFor="sampleSize">Jumlah sampel</label><input id="sampleSize" name="sampleSize" type="number" inputMode="numeric" min="1" className="input" placeholder="opsional" /></div>
              </div>
            )}
            {kind === "mortality" && (<>
              <div className="grid g2">
                <div className="field"><label htmlFor="count">Jumlah ekor</label><input id="count" name="count" type="number" inputMode="numeric" min="1" defaultValue="1" className="input" required /></div>
                <div className="field"><label htmlFor="cause">Penyebab</label><select id="cause" name="cause" className="input" defaultValue="UNKNOWN">{CAUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              </div>
              <div className="field"><label htmlFor="note">Catatan</label><input id="note" name="note" className="input" maxLength={500} placeholder="opsional" /></div>
            </>)}
            {kind === "feed" && (<>
              <div className="field"><label htmlFor="feedName">Jenis pakan</label><input id="feedName" name="feedName" list="feed-names" className="input" required maxLength={80} placeholder="contoh: Pelet BR-1" /><datalist id="feed-names">{feedNames.map((n) => <option key={n} value={n} />)}</datalist><span className="hint">Ketik nama baru kalau belum ada, otomatis tersimpan.</span></div>
              <div className="grid g2">
                <div className="field"><label htmlFor="quantityKg">Jumlah (kg)</label><input id="quantityKg" name="quantityKg" type="number" inputMode="decimal" step="0.001" min="0.001" className="input" required /></div>
                <div className="field"><label htmlFor="costTotal">Biaya total (Rp)</label><input id="costTotal" name="costTotal" type="number" inputMode="numeric" min="0" className="input" placeholder="opsional" /></div>
              </div>
            </>)}
            {kind === "production" && (<>
              <div className="grid g2">
                <div className="field"><label htmlFor="prodKind">Jenis produksi</label><select id="prodKind" name="prodKind" className="input" defaultValue="EGG"><option value="EGG">Telur (butir)</option><option value="MILK">Susu (liter)</option><option value="HARVEST">Panen (kg)</option></select></div>
                <div className="field"><label htmlFor="quantity">Jumlah</label><input id="quantity" name="quantity" type="number" inputMode="decimal" step="0.001" min="0.001" className="input" required /></div>
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
                <div className="grow"><div style={{ fontWeight: 600 }}>{LABEL[q.path]}</div><div className="xs muted">{q.error ?? new Date(q.queuedAt).toLocaleString("id-ID")}</div></div>
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
