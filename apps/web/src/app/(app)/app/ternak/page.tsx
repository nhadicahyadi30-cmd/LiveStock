"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Empty, Modal, Skeleton, Spinner, fmt, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

interface Farm { id: string; name: string; code: string }
interface Species { id: string; name: string }
interface Batch { id: string; code: string; farmId: string; speciesId: string; status: string; startDate: string; initialCount: number; currentCount: number }
interface Animal { id: string; code: string; name: string | null; farmId: string; speciesId: string; sex: string | null; status: string }
type SortKey = "code" | "startDate" | "initialCount" | "currentCount";
const SEX: Record<string, string> = { MALE: "Jantan", FEMALE: "Betina", UNKNOWN: "Tidak diketahui" };
const ASTATUS: Record<string, string> = { ACTIVE: "Aktif", SOLD: "Terjual", DEAD: "Mati", CULLED: "Afkir", TRANSFERRED: "Dipindah" };

function LivestockInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState<"batch" | "animal">("batch");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "CLOSED">("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "startDate", dir: -1 });
  const [farms, setFarms] = useState<Farm[] | null>(null);
  const [species, setSpecies] = useState<Species[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [modal, setModal] = useState<null | "batch" | "animal" | "farm">(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [f, s, b, a] = await Promise.all([
      api<{ data: Farm[] }>("/farms"), api<{ data: Species[] }>("/species"),
      api<{ data: Batch[] }>("/batches?limit=100"), api<{ data: Animal[] }>("/animals?limit=100"),
    ]);
    setFarms(f.data); setSpecies(s.data); setBatches(b.data); setAnimals(a.data);
  }, []);
  useEffect(() => { load().catch((e: Error) => { setLoadErr(e.message); setFarms([]); }); }, [load]);

  const farmName = useMemo(() => new Map((farms ?? []).map((f) => [f.id, f.name])), [farms]);
  const speciesName = useMemo(() => new Map(species.map((s) => [s.id, s.name])), [species]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return batches
      .filter((b) => (status === "ALL" || b.status === status) && (!t || b.code.toLowerCase().includes(t) || (speciesName.get(b.speciesId) ?? "").toLowerCase().includes(t) || (farmName.get(b.farmId) ?? "").toLowerCase().includes(t)))
      .sort((a, b) => { const x = a[sort.key], y = b[sort.key]; return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir; });
  }, [batches, q, status, sort, speciesName, farmName]);
  const animalRows = useMemo(() => { const t = q.trim().toLowerCase(); return animals.filter((a) => !t || a.code.toLowerCase().includes(t) || (a.name ?? "").toLowerCase().includes(t)); }, [animals, q]);

  const th = (key: SortKey, label: string, cls = "") => (
    <th className={`sortable ${cls}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      {label}{sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  );

  async function submit(e: FormEvent<HTMLFormElement>, path: string, build: (f: FormData) => unknown, okText: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      await api(path, { body: build(f) });
      toast({ kind: "ok", title: okText });
      setModal(null);
      await load();
    } catch (error) {
      if (error instanceof ApiFailure) setErr(error.status === 403 ? "Role Anda tidak boleh menambah data ini." : error.code === "CONFLICT" ? "Kode sudah dipakai. Gunakan kode lain." : error.code === "VALIDATION_ERROR" ? "Data belum valid. Periksa isian." : error.message);
      else setErr("Tidak ada koneksi. Coba lagi saat online.");
    } finally { setBusy(false); }
  }

  const footer = (formId: string) => (<><button className="btn btn-secondary" onClick={() => setModal(null)} type="button">Batal</button><button className="btn btn-primary" form={formId} type="submit" disabled={busy}>{busy ? <><Spinner /> Menyimpan…</> : "Simpan"}</button></>);
  const farmSelect = (<div className="field"><label htmlFor="farmId">Farm</label><select id="farmId" name="farmId" className="input" required defaultValue={farms?.[0]?.id}>{(farms ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>);
  const speciesSelect = (<div className="field"><label htmlFor="speciesId">Spesies</label><select id="speciesId" name="speciesId" className="input" required defaultValue=""><option value="" disabled>Pilih spesies</option>{species.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>);
  const codeField = (label: string) => (<div className="field"><label htmlFor="code">{label}</label><input id="code" name="code" className="input" required maxLength={32} pattern="[A-Za-z0-9._\-]+" placeholder="contoh: B-001" /><span className="hint">Huruf, angka, titik, garis bawah, atau strip.</span></div>);

  return (
    <main className="page">
      <div className="page-h">
        <div><h1>Ternak</h1><p>Kelola batch dan ternak individual di semua farm Anda.</p></div>
        <div className="row">
          {farms && farms.length > 0 && <button className="btn btn-primary" onClick={() => { setErr(null); setModal(tab === "batch" ? "batch" : "animal"); }}><Icon name="plus" size={18} /> {tab === "batch" ? "Tambah batch" : "Tambah ternak"}</button>}
        </div>
      </div>
      {loadErr && <div className="alert err" role="alert"><Icon name="alert" /> {loadErr}</div>}

      {farms && farms.length === 0 && !loadErr ? (
        <div className="card"><Empty icon="farm" title="Mulai dengan membuat farm" text="Farm adalah lokasi peternakan Anda. Batch dan ternak dikelompokkan di bawahnya." action={<button className="btn btn-primary" onClick={() => { setErr(null); setModal("farm"); }}><Icon name="plus" size={18} /> Buat farm pertama</button>} /></div>
      ) : (
        <div className="card">
          <div className="card-h wrap">
            <div className="seg"><button className={tab === "batch" ? "on" : ""} onClick={() => setTab("batch")}>Batch ({batches.length})</button><button className={tab === "animal" ? "on" : ""} onClick={() => setTab("animal")}>Individual ({animals.length})</button></div>
            <div className="row wrap">
              {tab === "batch" && <div className="chips">{(["ALL", "ACTIVE", "CLOSED"] as const).map((s) => <button key={s} className={`chip ${status === s ? "on" : ""}`} onClick={() => setStatus(s)}>{s === "ALL" ? "Semua" : s === "ACTIVE" ? "Aktif" : "Ditutup"}</button>)}</div>}
              <div className="search" style={{ width: 240 }}><Icon name="search" size={18} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode, spesies, farm" aria-label="Cari" /></div>
            </div>
          </div>
          {!farms ? <div className="card-b col"><Skeleton h={40} /><Skeleton h={40} /><Skeleton h={40} /></div> : tab === "batch" ? (
            rows.length === 0 ? <Empty icon="layers" title={batches.length ? "Tidak ada yang cocok" : "Belum ada batch"} text={batches.length ? "Ubah kata kunci atau filter." : "Tambahkan batch pertama untuk mulai mencatat."} /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr>{th("code", "Kode")}<th>Spesies</th><th>Farm</th>{th("startDate", "Mulai")}{th("initialCount", "Awal", "num")}{th("currentCount", "Populasi", "num")}<th>Status</th><th /></tr></thead>
                <tbody>{rows.map((b) => (
                  <tr key={b.id} className="click" onClick={() => router.push(`/app/ternak/${b.id}`)}>
                    <td><b>{b.code}</b></td><td>{speciesName.get(b.speciesId) ?? "-"}</td><td>{farmName.get(b.farmId) ?? "-"}</td><td className="nowrap">{fmtDate(b.startDate)}</td>
                    <td className="num">{fmt(b.initialCount)}</td><td className="num"><b>{fmt(b.currentCount)}</b></td>
                    <td><span className={`badge dot ${b.status === "ACTIVE" ? "ok" : ""}`}>{b.status === "ACTIVE" ? "Aktif" : "Ditutup"}</span></td>
                    <td className="tr"><Icon name="chevron" size={18} /></td>
                  </tr>))}</tbody>
              </table></div>)
          ) : animalRows.length === 0 ? <Empty icon="layers" title="Belum ada ternak individual" text="Cocok untuk sapi, kambing, dan domba yang dicatat per ekor." /> : (
            <div className="table-wrap"><table className="table"><thead><tr><th>Kode</th><th>Nama</th><th>Spesies</th><th>Farm</th><th>Kelamin</th><th>Status</th></tr></thead>
              <tbody>{animalRows.map((a) => (<tr key={a.id}><td><b>{a.code}</b></td><td>{a.name ?? "-"}</td><td>{speciesName.get(a.speciesId) ?? "-"}</td><td>{farmName.get(a.farmId) ?? "-"}</td><td>{a.sex ? SEX[a.sex] : "-"}</td><td><span className={`badge dot ${a.status === "ACTIVE" ? "ok" : ""}`}>{ASTATUS[a.status] ?? a.status}</span></td></tr>))}</tbody></table></div>
          )}
        </div>
      )}

      {modal === "farm" && (
        <Modal title="Buat farm" onClose={() => setModal(null)} footer={footer("f-farm")}>
          <form id="f-farm" onSubmit={(e) => void submit(e, "/farms", (f) => ({ name: f.get("name"), code: f.get("code"), address: f.get("address") || undefined }), "Farm dibuat")}>
            {err && <div className="alert err" role="alert">{err}</div>}
            <div className="field"><label htmlFor="name">Nama farm</label><input id="name" name="name" className="input" required maxLength={120} placeholder="contoh: Kandang Utama" /></div>
            {codeField("Kode farm")}
            <div className="field"><label htmlFor="address">Alamat</label><input id="address" name="address" className="input" maxLength={300} placeholder="opsional" /></div>
          </form>
        </Modal>)}
      {modal === "batch" && (
        <Modal title="Tambah batch" onClose={() => setModal(null)} footer={footer("f-batch")}>
          <form id="f-batch" onSubmit={(e) => void submit(e, "/batches", (f) => ({ farmId: f.get("farmId"), speciesId: f.get("speciesId"), code: f.get("code"), startDate: f.get("startDate"), initialCount: Number(f.get("initialCount")), clientId: crypto.randomUUID() }), "Batch ditambahkan")}>
            {err && <div className="alert err" role="alert">{err}</div>}
            {farmSelect}{speciesSelect}{codeField("Kode batch")}
            <div className="grid g2"><div className="field"><label htmlFor="startDate">Tanggal mulai</label><input id="startDate" name="startDate" type="date" className="input" required /></div>
              <div className="field"><label htmlFor="initialCount">Jumlah awal</label><input id="initialCount" name="initialCount" type="number" inputMode="numeric" min="1" className="input" required /></div></div>
          </form>
        </Modal>)}
      {modal === "animal" && (
        <Modal title="Tambah ternak individual" onClose={() => setModal(null)} footer={footer("f-animal")}>
          <form id="f-animal" onSubmit={(e) => void submit(e, "/animals", (f) => ({ farmId: f.get("farmId"), speciesId: f.get("speciesId"), code: f.get("code"), name: f.get("name") || undefined, sex: f.get("sex") || undefined, birthDate: f.get("birthDate") || undefined, clientId: crypto.randomUUID() }), "Ternak ditambahkan")}>
            {err && <div className="alert err" role="alert">{err}</div>}
            {farmSelect}{speciesSelect}{codeField("Kode / nomor telinga")}
            <div className="field"><label htmlFor="name">Nama</label><input id="name" name="name" className="input" maxLength={120} placeholder="opsional" /></div>
            <div className="grid g2"><div className="field"><label htmlFor="sex">Jenis kelamin</label><select id="sex" name="sex" className="input" defaultValue=""><option value="">-</option><option value="MALE">Jantan</option><option value="FEMALE">Betina</option></select></div>
              <div className="field"><label htmlFor="birthDate">Tanggal lahir</label><input id="birthDate" name="birthDate" type="date" className="input" /></div></div>
          </form>
        </Modal>)}
    </main>
  );
}

export default function LivestockPage() { return <Suspense><LivestockInner /></Suspense>; }
