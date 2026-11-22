"use client";
import { useCallback, useEffect, useState } from "react";
import { Empty, Modal, Skeleton, useToast } from "@/components/ui";
import { api } from "@/lib/api";

interface Vet { orgId: string; displayName: string; city: string; specialty: string; licenseNo: string | null; about: string | null }
interface Consult { id: string; subject: string; species: string; status: string; updatedAt: string; counterparty: string }
interface Msg { id: string; mine: boolean; fromVet: boolean; body: string; createdAt: string }
interface Detail { id: string; subject: string; species: string; status: string; side: "farm" | "vet"; messages: Msg[] }
interface Profile { displayName: string; city: string; specialty: string; licenseNo: string | null; about: string | null; accepting: boolean }

type Tab = "ask" | "inbox" | "profile";
const ST: Record<string, string> = { OPEN: "Menunggu jawaban", ANSWERED: "Sudah dijawab", CLOSED: "Ditutup" };
const when = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

export default function DokterPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("ask");
  const [vets, setVets] = useState<Vet[] | null>(null);
  const [mine, setMine] = useState<Consult[] | null>(null);
  const [inbox, setInbox] = useState<Consult[] | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [newFor, setNewFor] = useState<Vet | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ data: Vet[] }>("/vet/vets").then((r) => setVets(r.data)).catch(() => setVets([]));
    api<{ data: Consult[] }>("/vet/consultations?role=ask").then((r) => setMine(r.data)).catch(() => setMine([]));
    api<{ data: Consult[] }>("/vet/consultations?role=answer").then((r) => setInbox(r.data)).catch(() => setInbox([]));
    api<{ data: Profile | null }>("/vet/profile").then((r) => setProfile(r.data)).catch(() => setProfile(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createConsult(form: HTMLFormElement) {
    const f = new FormData(form); setBusy(true);
    try {
      const r = await api<{ data: { id: string } }>("/vet/consultations", { body: { vetOrgId: newFor!.orgId, subject: String(f.get("subject")), species: String(f.get("species")), symptoms: String(f.get("symptoms")) } });
      toast({ kind: "ok", title: "Konsultasi dikirim" }); setNewFor(null); load(); setOpenId(r.data.id);
    } catch (e) { toast({ kind: "err", title: (e as Error).message }); } finally { setBusy(false); }
  }
  async function saveProfile(form: HTMLFormElement) {
    const f = new FormData(form); setBusy(true);
    try {
      await api("/vet/profile", { method: "PUT", body: { displayName: String(f.get("displayName")), city: String(f.get("city")), specialty: String(f.get("specialty")), licenseNo: String(f.get("licenseNo") ?? "").trim() || undefined, about: String(f.get("about") ?? "").trim() || undefined, accepting: f.get("accepting") === "on" } });
      toast({ kind: "ok", title: "Profil dokter disimpan" }); load();
    } catch (e) { toast({ kind: "err", title: (e as Error).message }); } finally { setBusy(false); }
  }

  const List = ({ items }: { items: Consult[] | null }) => items === null ? <Skeleton h={120} /> : items.length === 0 ? <Empty icon="heart" title="Belum ada konsultasi" /> : (
    <div className="card"><div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>{items.map((c) => (
      <button key={c.id} className="list-item" style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer" }} onClick={() => setOpenId(c.id)}>
        <div className="grow"><div style={{ fontWeight: 600 }}>{c.subject} <span className="badge">{ST[c.status]}</span></div><div className="xs muted">{c.species} · {c.counterparty} · {when(c.updatedAt)}</div></div>
      </button>))}</div></div>
  );

  return (
    <main className="page">
      <div className="page-h"><div><h1>Konsultasi dokter hewan</h1><p>Tanyakan gejala ternak ke dokter hewan, atau daftar sebagai dokter hewan untuk menjawab.</p></div></div>
      <div className="alert warn" style={{ marginBottom: 16 }}>Konsultasi tertulis tidak menggantikan pemeriksaan langsung. Untuk ternak yang parah atau kematian mendadak, segera hubungi dokter hewan terdekat. Nomor izin dokter diisi sendiri dan belum diverifikasi platform.</div>
      <div className="seg" role="tablist" style={{ flexWrap: "wrap", marginBottom: 16 }}>
        {([["ask", "Tanya dokter"], ["inbox", `Konsultasi masuk${inbox && inbox.filter((c) => c.status === "OPEN").length ? ` (${inbox.filter((c) => c.status === "OPEN").length})` : ""}`], ["profile", "Profil dokter"]] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} type="button">{l}</button>)}
      </div>

      {tab === "ask" && (<>
        <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Dokter hewan tersedia</h2>
        {vets === null ? <Skeleton h={120} /> : vets.length === 0 ? <Empty icon="heart" title="Belum ada dokter hewan terdaftar" text="Dokter hewan bisa mendaftar lewat tab Profil dokter." /> : (
          <div className="grid g2">{vets.map((v) => (
            <div className="card card-pad" key={v.orgId}>
              <h3>{v.displayName}</h3><div className="xs muted">{v.specialty} · {v.city}{v.licenseNo ? ` · izin ${v.licenseNo} (belum diverifikasi)` : ""}</div>
              {v.about && <p className="sm mt-1">{v.about}</p>}
              <button className="btn btn-primary btn-sm mt-1" onClick={() => setNewFor(v)}>Konsultasi</button>
            </div>))}</div>)}
        <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Konsultasi saya</h2>
        <List items={mine} />
      </>)}
      {tab === "inbox" && (profile ? <List items={inbox} /> : <Empty icon="heart" title="Kamu belum terdaftar sebagai dokter hewan" text="Isi Profil dokter agar peternak bisa mengirim konsultasi." action={<button className="btn btn-primary btn-sm" onClick={() => setTab("profile")}>Buka profil dokter</button>} />)}
      {tab === "profile" && (profile === undefined ? <Skeleton h={200} /> : (
        <form className="card card-pad stack" onSubmit={(e) => { e.preventDefault(); void saveProfile(e.currentTarget); }}>
          <div className="field"><label htmlFor="dn">Nama praktik / dokter</label><input id="dn" name="displayName" className="input" required minLength={2} defaultValue={profile?.displayName ?? ""} /></div>
          <div className="grid g2"><div className="field"><label htmlFor="dc">Kota</label><input id="dc" name="city" className="input" required defaultValue={profile?.city ?? ""} /></div><div className="field"><label htmlFor="ds">Keahlian</label><input id="ds" name="specialty" className="input" required placeholder="unggas, ruminansia, akuakultur" defaultValue={profile?.specialty ?? ""} /></div></div>
          <div className="field"><label htmlFor="dl">Nomor izin praktik (opsional)</label><input id="dl" name="licenseNo" className="input" defaultValue={profile?.licenseNo ?? ""} /></div>
          <div className="field"><label htmlFor="da">Tentang</label><input id="da" name="about" className="input" maxLength={500} defaultValue={profile?.about ?? ""} /></div>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" name="accepting" defaultChecked={profile?.accepting ?? true} /> Terima konsultasi baru</label>
          <button className="btn btn-primary" disabled={busy}>{profile ? "Simpan profil" : "Daftar sebagai dokter hewan"}</button>
        </form>))}

      {newFor && (
        <Modal title={`Konsultasi ke ${newFor.displayName}`} onClose={() => setNewFor(null)}>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void createConsult(e.currentTarget); }}>
            <div className="field"><label htmlFor="cs">Judul</label><input id="cs" name="subject" className="input" required minLength={3} placeholder="contoh: Ayam lesu dan mencret" /></div>
            <div className="field"><label htmlFor="cp">Jenis ternak</label><input id="cp" name="species" className="input" required placeholder="ayam broiler, sapi, lele..." /></div>
            <div className="field"><label htmlFor="cy">Gejala dan keterangan</label><textarea id="cy" name="symptoms" className="input" rows={5} required minLength={10} placeholder="Sejak kapan, berapa ekor yang sakit, umur, pakan terakhir, vaksin terakhir..." /></div>
            <button className="btn btn-primary" disabled={busy}>Kirim</button>
          </form>
        </Modal>)}
      {openId && <ThreadModal id={openId} onClose={() => { setOpenId(null); load(); }} />}
    </main>
  );
}

function ThreadModal({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<{ data: Detail }>(`/vet/consultations/${id}`).then((r) => setD(r.data)).catch((e: Error) => toast({ kind: "err", title: e.message })); }, [id, toast]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  async function send() {
    setBusy(true);
    try { await api(`/vet/consultations/${id}/messages`, { body: { body: text } }); setText(""); load(); } catch (e) { toast({ kind: "err", title: (e as Error).message }); } finally { setBusy(false); }
  }
  async function close() {
    if (!window.confirm("Tutup konsultasi ini? Percakapan tidak bisa dilanjutkan.")) return;
    try { await api(`/vet/consultations/${id}/close`, { body: {} }); toast({ kind: "ok", title: "Konsultasi ditutup" }); load(); } catch (e) { toast({ kind: "err", title: (e as Error).message }); }
  }
  return (
    <Modal title={d ? d.subject : "Konsultasi"} onClose={onClose}>
      {!d ? <Skeleton h={160} /> : (<div className="stack">
        <div className="xs muted">{d.species} · <span className="badge">{ST[d.status]}</span></div>
        <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gap: 8 }}>
          {d.messages.map((m) => (
            <div key={m.id} style={{ justifySelf: m.mine ? "end" : "start", maxWidth: "85%", background: m.mine ? "var(--brand-soft, #e6f4ea)" : "var(--surface-2, #f3f4f6)", borderRadius: 10, padding: "8px 12px" }}>
              <div className="xs muted">{m.fromVet ? "Dokter hewan" : "Peternak"} · {when(m.createdAt)}</div>
              <div className="sm" style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>))}
        </div>
        {d.status !== "CLOSED" && (<>
          <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis balasan..." aria-label="Balasan" />
          <div className="row" style={{ gap: 8 }}><button className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => void send()}>Kirim</button><button className="btn btn-ghost" onClick={() => void close()}>Tutup konsultasi</button></div>
        </>)}
      </div>)}
    </Modal>
  );
}
