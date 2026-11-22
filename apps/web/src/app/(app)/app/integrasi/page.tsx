"use client";
import { useCallback, useEffect, useState } from "react";
import { Empty, Modal, Skeleton, useToast } from "@/components/ui";
import { api } from "@/lib/api";

interface Key { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }
interface Ep { id: string; url: string; events: string[]; active: boolean }
interface Dl { id: string; endpointId: string; event: string; status: string; attempts: number; responseStatus: number | null; lastError: string | null; createdAt: string }
interface Hooks { events: string[]; endpoints: Ep[]; deliveries: Dl[] }

const when = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const DST: Record<string, string> = { PENDING: "Menunggu", DELIVERED: "Terkirim", FAILED: "Gagal" };

export default function IntegrasiPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"keys" | "hooks">("keys");
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [hooks, setHooks] = useState<Hooks | null>(null);
  const [secret, setSecret] = useState<{ title: string; label: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(() => {
    api<{ data: Key[] }>("/integrations/keys").then((r) => setKeys(r.data)).catch(() => { setKeys([]); setForbidden(true); });
    api<{ data: Hooks }>("/integrations/webhooks").then((r) => setHooks(r.data)).catch(() => setHooks({ events: [], endpoints: [], deliveries: [] }));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); load(); } catch (e) { toast({ kind: "err", title: (e as Error).message }); } finally { setBusy(false); }
  }
  const createKey = (form: HTMLFormElement) => run(async () => {
    const f = new FormData(form);
    const r = await api<{ data: { key: string } }>("/integrations/keys", { body: { name: String(f.get("name")) } });
    form.reset(); setSecret({ title: "Kunci API dibuat", label: "Salin kunci ini sekarang. Tidak akan ditampilkan lagi.", value: r.data.key });
  });
  const createHook = (form: HTMLFormElement) => run(async () => {
    const f = new FormData(form);
    const events = f.getAll("events").map(String);
    const r = await api<{ data: { secret: string } }>("/integrations/webhooks", { body: { url: String(f.get("url")), events } });
    form.reset(); setSecret({ title: "Webhook dibuat", label: "Rahasia penanda tangan (untuk memverifikasi X-NT-Signature). Tidak akan ditampilkan lagi.", value: r.data.secret });
  });

  if (forbidden) return <main className="page"><Empty icon="shield" title="Khusus pemilik" text="Kunci API dan webhook hanya bisa dikelola pemilik organisasi." /></main>;
  return (
    <main className="page">
      <div className="page-h"><div><h1>Integrasi</h1><p>Kunci API untuk membaca data dari sistem lain, dan webhook yang memberi tahu sistem lain saat ada kejadian.</p></div></div>
      <div className="seg" role="tablist" style={{ marginBottom: 16 }}>
        <button role="tab" aria-selected={tab === "keys"} className={tab === "keys" ? "on" : ""} type="button" onClick={() => setTab("keys")}>Kunci API</button>
        <button role="tab" aria-selected={tab === "hooks"} className={tab === "hooks" ? "on" : ""} type="button" onClick={() => setTab("hooks")}>Webhook</button>
      </div>

      {tab === "keys" && (<>
        <form className="card card-pad row" style={{ gap: 8, alignItems: "flex-end" }} onSubmit={(e) => { e.preventDefault(); void createKey(e.currentTarget); }}>
          <div className="field grow"><label htmlFor="kn">Nama kunci</label><input id="kn" name="name" className="input" required minLength={2} placeholder="contoh: Dashboard Power BI" /></div>
          <button className="btn btn-primary" disabled={busy}>Buat kunci</button>
        </form>
        <div className="mt-2">{keys === null ? <Skeleton h={100} /> : keys.length === 0 ? <Empty icon="shield" title="Belum ada kunci API" /> : (
          <div className="card"><div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>{keys.map((k) => (
            <div className="list-item" key={k.id}>
              <div className="grow"><div style={{ fontWeight: 600 }}>{k.name} <span className={`badge ${k.revokedAt ? "warn" : "ok"}`}>{k.revokedAt ? "Dicabut" : "Aktif"}</span></div><div className="xs muted"><code>{k.prefix}…</code> · dibuat {when(k.createdAt)} · {k.lastUsedAt ? `dipakai ${when(k.lastUsedAt)}` : "belum pernah dipakai"}</div></div>
              {!k.revokedAt && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { if (window.confirm(`Cabut kunci "${k.name}"? Sistem yang memakainya akan berhenti bekerja.`)) void run(async () => { await api(`/integrations/keys/${k.id}`, { method: "DELETE" }); }); }}>Cabut</button>}
            </div>))}</div></div>)}</div>
        <div className="card card-pad mt-2">
          <h3>Cara memakai</h3>
          <p className="sm muted">Baca-saja. Maksimal 60 permintaan per menit per kunci.</p>
          <pre className="sm" style={{ overflowX: "auto" }}>{`curl https://DOMAINMU/api/open/v1/batches?status=ACTIVE \\
  -H "Authorization: Bearer nt_key_..."`}</pre>
          <p className="xs muted">Endpoint: <code>/api/open/v1/farms</code>, <code>/batches</code>, <code>/feed-records</code>, <code>/production-records</code>, <code>/alerts</code>. Lihat docs/API.md.</p>
        </div>
      </>)}

      {tab === "hooks" && (<>
        <form className="card card-pad stack" onSubmit={(e) => { e.preventDefault(); void createHook(e.currentTarget); }}>
          <div className="field"><label htmlFor="wu">URL tujuan (https)</label><input id="wu" name="url" type="url" className="input" required placeholder="https://contoh.com/webhook/nusa-ternak" /></div>
          <fieldset style={{ border: 0, padding: 0 }}><legend className="sm">Kirim saat</legend>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>{(hooks?.events ?? []).map((ev) => <label key={ev} className="row sm" style={{ gap: 4 }}><input type="checkbox" name="events" value={ev} defaultChecked />{ev}</label>)}</div></fieldset>
          <button className="btn btn-primary" disabled={busy}>Tambah webhook</button>
        </form>
        <div className="mt-2">{hooks === null ? <Skeleton h={100} /> : hooks.endpoints.length === 0 ? <Empty icon="bell" title="Belum ada webhook" /> : (
          <div className="card"><div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>{hooks.endpoints.map((e) => (
            <div className="list-item" key={e.id} style={{ alignItems: "flex-start" }}>
              <div className="grow"><div style={{ fontWeight: 600, wordBreak: "break-all" }}>{e.url} <span className={`badge ${e.active ? "ok" : "warn"}`}>{e.active ? "Aktif" : "Nonaktif"}</span></div><div className="xs muted">{e.events.join(", ")}</div></div>
              <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(async () => { await api(`/integrations/webhooks/${e.id}/test`, { body: {} }); toast({ kind: "ok", title: "Uji dikirim. Muat ulang log beberapa detik lagi." }); })}>Uji</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(async () => { await api(`/integrations/webhooks/${e.id}`, { method: "PATCH", body: { active: !e.active } }); })}>{e.active ? "Nonaktifkan" : "Aktifkan"}</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { if (window.confirm("Hapus webhook ini?")) void run(async () => { await api(`/integrations/webhooks/${e.id}`, { method: "DELETE" }); }); }}>Hapus</button>
              </div>
            </div>))}</div></div>)}</div>
        <h2 style={{ fontSize: 18, margin: "24px 0 8px" }}>Log pengiriman <button className="btn btn-ghost btn-sm" onClick={load}>Muat ulang</button></h2>
        {hooks && hooks.deliveries.length === 0 ? <p className="sm muted">Belum ada pengiriman.</p> : (
          <div className="card"><div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>{hooks?.deliveries.map((d) => (
            <div className="list-item" key={d.id}>
              <div className="grow"><div style={{ fontWeight: 600 }}>{d.event} <span className={`badge ${d.status === "FAILED" ? "warn" : d.status === "DELIVERED" ? "ok" : ""}`}>{DST[d.status]}</span></div><div className="xs muted">{when(d.createdAt)} · percobaan {d.attempts}{d.responseStatus ? ` · HTTP ${d.responseStatus}` : ""}{d.lastError ? ` · ${d.lastError}` : ""}</div></div>
              {d.status !== "DELIVERED" && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(async () => { await api(`/integrations/deliveries/${d.id}/retry`, { body: {} }); })}>Kirim ulang</button>}
            </div>))}</div></div>)}
        <div className="card card-pad mt-2">
          <h3>Memverifikasi tanda tangan</h3>
          <p className="sm muted">Tiap kiriman memuat header <code>X-NT-Timestamp</code> dan <code>X-NT-Signature</code> = <code>sha256=HMAC_SHA256(rahasia, timestamp + "." + isi_mentah)</code>. Tolak bila timestamp lebih dari 5 menit dari waktu sekarang. Jawab 2xx agar dianggap terkirim; kegagalan dicoba ulang sampai 5 kali.</p>
        </div>
      </>)}

      {secret && (
        <Modal title={secret.title} onClose={() => setSecret(null)}>
          <div className="stack"><p className="sm">{secret.label}</p>
            <input className="input" readOnly value={secret.value} onFocus={(e) => e.currentTarget.select()} aria-label={secret.title} />
            <button className="btn btn-primary" onClick={() => { void navigator.clipboard?.writeText(secret.value).then(() => toast({ kind: "ok", title: "Disalin" })).catch(() => undefined); }}>Salin</button></div>
        </Modal>)}
    </main>
  );
}
