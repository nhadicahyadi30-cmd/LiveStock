"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiFailure } from "@/lib/api";

interface Farm { id: string; name: string; code: string }
interface Species { id: string; name: string }
interface Batch { id: string; code: string; status: string; currentCount: number }

export default function LivestockPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [f, s, b] = await Promise.all([
      api<{ data: Farm[] }>("/farms"), api<{ data: Species[] }>("/species"), api<{ data: Batch[] }>("/batches"),
    ]);
    setFarms(f.data); setSpecies(s.data); setBatches(b.data);
  }, []);
  useEffect(() => { load().catch((e: Error) => setMsg(e.message)); }, [load]);

  async function submit(e: FormEvent<HTMLFormElement>, path: string, build: (f: FormData) => unknown) {
    e.preventDefault();
    const form = e.currentTarget;
    setMsg(null);
    try {
      await api(path, { body: build(new FormData(form)) });
      form.reset();
      await load();
    } catch (err) {
      setMsg(err instanceof ApiFailure && err.status === 403 ? "Role Anda tidak boleh menambah data ini." : err instanceof Error ? err.message : "Gagal");
    }
  }

  return (
    <main className="page">
      <h1>Ternak</h1>
      {msg && <div className="msg err">{msg}</div>}

      <h2>Batch</h2>
      {batches.map((b) => (
        <div className="card row" key={b.id}>
          <div><strong>{b.code}</strong> <span className="pill">{b.status === "ACTIVE" ? "Aktif" : "Ditutup"}</span></div>
          <div>{b.currentCount.toLocaleString("id-ID")} ekor</div>
        </div>
      ))}

      {farms.length === 0 ? (
        <form className="card" onSubmit={(e) => submit(e, "/farms", (f) => ({ name: f.get("name"), code: f.get("code") }))}>
          <strong>Buat farm pertama</strong>
          <label htmlFor="fname">Nama farm</label><input id="fname" name="name" required />
          <label htmlFor="fcode">Kode</label><input id="fcode" name="code" required pattern="[A-Za-z0-9._\-]+" maxLength={32} />
          <div style={{ marginTop: 12 }}><button type="submit">Simpan farm</button></div>
        </form>
      ) : (
        <form className="card" onSubmit={(e) => submit(e, "/batches", (f) => ({
          farmId: f.get("farmId"), speciesId: f.get("speciesId"), code: f.get("code"),
          startDate: f.get("startDate"), initialCount: Number(f.get("initialCount")), clientId: crypto.randomUUID(),
        }))}>
          <strong>Tambah batch</strong>
          <label htmlFor="farmId">Farm</label>
          <select id="farmId" name="farmId" required defaultValue={farms[0]?.id}>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <label htmlFor="speciesId">Spesies</label>
          <select id="speciesId" name="speciesId" required defaultValue="">
            <option value="" disabled>Pilih spesies</option>{species.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label htmlFor="code">Kode batch</label><input id="code" name="code" required pattern="[A-Za-z0-9._\-]+" maxLength={32} />
          <label htmlFor="startDate">Tanggal mulai</label><input id="startDate" name="startDate" type="date" required />
          <label htmlFor="initialCount">Jumlah awal</label><input id="initialCount" name="initialCount" type="number" inputMode="numeric" min="1" required />
          <div style={{ marginTop: 12 }}><button type="submit">Simpan batch</button></div>
        </form>
      )}
    </main>
  );
}
