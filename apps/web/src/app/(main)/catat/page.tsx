"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiFailure, NetworkFailure } from "@/lib/api";
import { enqueue } from "@/lib/offline-queue";

interface Batch { id: string; code: string; currentCount: number }
type Kind = "weight" | "mortality";

const today = () => new Date().toISOString().slice(0, 10);
const CAUSES = [["UNKNOWN", "Tidak diketahui"], ["DISEASE", "Penyakit"], ["INJURY", "Cedera"], ["PREDATION", "Predator"], ["ENVIRONMENT", "Lingkungan"], ["OTHER", "Lainnya"]];

export default function RecordPage() {
  const [kind, setKind] = useState<Kind>("weight");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "warn" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ data: Batch[] }>("/batches?status=ACTIVE").then((r) => setBatches(r.data)).catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const clientId = crypto.randomUUID(); // dibuat sebelum kirim: percobaan ulang tidak menggandakan data
    const batchId = String(f.get("batchId"));
    const path = kind === "weight" ? "/weight-records" : "/mortality-records";
    const body: Record<string, unknown> =
      kind === "weight"
        ? { batchId, clientId, measuredOn: f.get("date"), weightKg: Number(f.get("weightKg")), sampleSize: f.get("sampleSize") ? Number(f.get("sampleSize")) : undefined }
        : { batchId, clientId, occurredOn: f.get("date"), count: Number(f.get("count")), cause: f.get("cause"), note: f.get("note") || undefined };

    setBusy(true);
    setMsg(null);
    try {
      await api(path, { body });
      setMsg({ type: "ok", text: "Tersimpan." });
      form.reset();
    } catch (err) {
      if (err instanceof NetworkFailure) {
        try {
          enqueue(path, body);
          setMsg({ type: "warn", text: "Tidak ada koneksi. Catatan disimpan di perangkat dan dikirim otomatis saat online." });
          form.reset();
        } catch (qe) {
          setMsg({ type: "err", text: (qe as Error).message });
        }
      } else if (err instanceof ApiFailure && err.code === "VALIDATION_ERROR") {
        setMsg({ type: "err", text: "Data belum valid. Periksa angka dan tanggal." });
      } else {
        setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal menyimpan" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>Catat</h1>
      <div className="seg">
        <button type="button" className={kind === "weight" ? "on" : ""} onClick={() => setKind("weight")}>Bobot</button>
        <button type="button" className={kind === "mortality" ? "on" : ""} onClick={() => setKind("mortality")}>Kematian</button>
      </div>
      <form className="card" onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <label htmlFor="batchId">Batch</label>
        <select id="batchId" name="batchId" required defaultValue="">
          <option value="" disabled>Pilih batch</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.code} ({b.currentCount} ekor)</option>)}
        </select>
        <label htmlFor="date">Tanggal</label>
        <input id="date" name="date" type="date" defaultValue={today()} max={today()} required />
        {kind === "weight" ? (
          <>
            <label htmlFor="weightKg">Bobot rata-rata (kg)</label>
            <input id="weightKg" name="weightKg" type="number" inputMode="decimal" step="0.001" min="0.001" required />
            <label htmlFor="sampleSize">Jumlah sampel (opsional)</label>
            <input id="sampleSize" name="sampleSize" type="number" inputMode="numeric" min="1" />
          </>
        ) : (
          <>
            <label htmlFor="count">Jumlah ekor</label>
            <input id="count" name="count" type="number" inputMode="numeric" min="1" defaultValue="1" required />
            <label htmlFor="cause">Penyebab</label>
            <select id="cause" name="cause" defaultValue="UNKNOWN">{CAUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <label htmlFor="note">Catatan (opsional)</label>
            <input id="note" name="note" maxLength={500} />
          </>
        )}
        {msg && <div className={`msg ${msg.type}`} role="status">{msg.text}</div>}
        <div style={{ marginTop: 14 }}><button type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? "Menyimpan…" : "Simpan"}</button></div>
      </form>
    </main>
  );
}
