"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useMe } from "@/components/app-shell";
import { Empty, Modal, Skeleton, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

interface Task { id: string; title: string; description: string | null; dueOn: string; status: "OPEN" | "DONE"; batchId: string | null; batchCode: string | null; assignedTo: string | null }
interface Batch { id: string; code: string }
interface Member { userId: string; name: string; role: string }
type Tab = "late" | "today" | "soon" | "done";
const TABS: [Tab, string][] = [["late", "Terlambat"], ["today", "Hari ini"], ["soon", "Mendatang"], ["done", "Selesai"]];
const day = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

export default function TugasPage() {
  const toast = useToast();
  const me = useMe();
  const role = me?.organizations.find((o) => o.id === me.activeOrganizationId)?.role;
  const canManage = role === "OWNER" || role === "MANAGER";
  const [tab, setTab] = useState<Tab>("today");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => api<{ data: Task[] }>("/tasks").then((r) => setTasks(r.data)).catch((e: Error) => { setErr(e.message); setTasks([]); }), []);
  useEffect(() => {
    void load();
    api<{ data: Batch[] }>("/batches?limit=100").then((r) => setBatches(r.data)).catch(() => undefined);
    api<{ data: Member[] }>("/members").then((r) => setMembers(r.data)).catch(() => undefined);
  }, [load]);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filtered = (tasks ?? []).filter((t) => {
    const d = day(t.dueOn);
    if (tab === "done") return t.status === "DONE";
    if (t.status !== "OPEN") return false;
    return tab === "late" ? d < today : tab === "today" ? d === today : d > today;
  });
  const count = (k: Tab) => (tasks ?? []).filter((t) => { const d = day(t.dueOn); return k === "done" ? t.status === "DONE" : t.status === "OPEN" && (k === "late" ? d < today : k === "today" ? d === today : d > today); }).length;

  async function toggle(t: Task) {
    try { await api(`/tasks/${t.id}`, { method: "PATCH", body: { status: t.status === "OPEN" ? "DONE" : "OPEN" } }); await load(); }
    catch (e) { toast({ kind: "err", title: e instanceof ApiFailure ? e.message : "Gagal memperbarui tugas" }); }
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(null);
    const f = new FormData(e.currentTarget);
    try {
      await api("/tasks", { body: { title: f.get("title"), description: f.get("description") || undefined, dueOn: f.get("dueOn"), batchId: f.get("batchId") || undefined, assignedTo: f.get("assignedTo") || undefined } });
      setModal(false); toast({ kind: "ok", title: "Tugas ditambahkan" }); await load();
    } catch (x) { setErr(x instanceof ApiFailure ? x.message : "Gagal menyimpan"); } finally { setBusy(false); }
  }

  return (
    <main className="page">
      <div className="page-head"><div><h1>Tugas</h1><p className="muted">Jadwal vaksin, pembersihan kandang, dan pekerjaan rutin lainnya.</p></div>{canManage && <button className="btn btn-primary" onClick={() => { setErr(null); setModal(true); }}>Tambah tugas</button>}</div>
      <div className="seg" role="tablist" style={{ flexWrap: "wrap" }}>{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} type="button">{l} ({count(k)})</button>)}</div>
      {err && !modal && <div className="alert err mt-2">{err}</div>}
      <div className="mt-3">
        {tasks === null ? <Skeleton h={160} /> : filtered.length === 0 ? <Empty icon="check" title="Tidak ada tugas" text="Semua beres di kategori ini." /> : (
          <div className="card">{filtered.map((t) => (
            <label key={t.id} className="row" style={{ gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line, #e5e7eb)", cursor: "pointer", alignItems: "flex-start" }}>
              <input type="checkbox" checked={t.status === "DONE"} onChange={() => void toggle(t)} style={{ marginTop: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, textDecoration: t.status === "DONE" ? "line-through" : "none" }}>{t.title}</div>
                <div className="xs muted">{fmtDate(t.dueOn)}{t.batchCode ? ` · ${t.batchCode}` : ""}{t.assignedTo ? ` · ${members.find((m) => m.userId === t.assignedTo)?.name ?? "Petugas"}` : ""}</div>
                {t.description && <div className="sm mt-1">{t.description}</div>}
              </div>
            </label>))}</div>
        )}
      </div>
      {modal && (
        <Modal title="Tambah tugas" onClose={() => setModal(false)}>
          <form onSubmit={(e) => void create(e)} className="stack">
            <div className="field"><label htmlFor="title">Judul</label><input id="title" name="title" className="input" required maxLength={160} /></div>
            <div className="field"><label htmlFor="description">Keterangan</label><input id="description" name="description" className="input" maxLength={1000} placeholder="opsional" /></div>
            <div className="grid g2">
              <div className="field"><label htmlFor="dueOn">Tenggat</label><input id="dueOn" name="dueOn" type="date" className="input" defaultValue={today} required /></div>
              <div className="field"><label htmlFor="batchId">Batch</label><select id="batchId" name="batchId" className="input" defaultValue=""><option value="">Semua / umum</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="assignedTo">Penanggung jawab</label><select id="assignedTo" name="assignedTo" className="input" defaultValue=""><option value="">Belum ditentukan</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select></div>
            {err && <div className="alert err">{err}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Menyimpan…" : "Simpan tugas"}</button>
          </form>
        </Modal>
      )}
    </main>
  );
}
