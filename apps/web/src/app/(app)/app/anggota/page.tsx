"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { roleLabel, useMe } from "@/components/app-shell";
import { Empty, Modal, Skeleton, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

interface Member { userId: string; name: string; role: string }
interface Invite { id: string; email: string; role: string; expiresAt: string }

export default function AnggotaPage() {
  const me = useMe();
  const toast = useToast();
  const myRole = me?.organizations.find((o) => o.id === me.activeOrganizationId)?.role;
  const canManage = myRole === "OWNER" || myRole === "MANAGER";
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [modal, setModal] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    api<{ data: Member[] }>("/members").then((r) => setMembers(r.data)).catch(() => setMembers([]));
    if (canManage) api<{ data: Invite[] }>("/invitations").then((r) => setInvites(r.data)).catch(() => undefined);
  }, [canManage]);
  useEffect(() => { void load(); }, [load]);

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(null);
    const f = new FormData(e.currentTarget);
    try { const r = await api<{ data: { link: string } }>("/invitations", { body: { email: f.get("email"), role: f.get("role") } }); setLink(r.data.link); await load(); }
    catch (x) { setErr(x instanceof ApiFailure ? x.message : "Gagal membuat undangan"); } finally { setBusy(false); }
  }
  async function act(fn: () => Promise<unknown>) { try { await fn(); await load(); } catch (x) { toast({ kind: "err", title: x instanceof ApiFailure ? x.message : "Gagal" }); } }
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast({ kind: "ok", title: "Tautan disalin" }); } catch { window.prompt("Salin tautan ini:", t); } };

  return (
    <main className="page">
      <div className="page-h"><div><h1>Anggota</h1><p>Undang petugas kandang dan atur perannya.</p></div>{canManage && <button className="btn btn-primary" onClick={() => { setErr(null); setLink(null); setModal(true); }}>Undang anggota</button>}</div>
      {members === null ? <Skeleton h={160} /> : members.length === 0 ? <Empty icon="users" title="Belum ada anggota" /> : (
        <div className="card table-wrap"><table className="table"><thead><tr><th>Nama</th><th>Peran</th>{canManage && <th />}</tr></thead><tbody>
          {members.map((m) => (<tr key={m.userId}><td>{m.name}{m.userId === me?.userId ? " (kamu)" : ""}</td><td>{roleLabel(m.role)}</td>
            {canManage && <td className="tr">{m.role !== "OWNER" && m.userId !== me?.userId && (<>
              <select className="input" style={{ width: "auto", display: "inline-block" }} value={m.role} aria-label="Ubah peran" onChange={(e) => void act(() => api(`/members/${m.userId}`, { method: "PATCH", body: { role: e.target.value } }))}>
                {myRole === "OWNER" && <option value="MANAGER">Manajer</option>}{m.role === "MANAGER" && myRole !== "OWNER" && <option value="MANAGER">Manajer</option>}<option value="WORKER">Petugas kandang</option><option value="VIEWER">Pengamat</option></select>{" "}
              <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm(`Keluarkan ${m.name}?`)) void act(() => api(`/members/${m.userId}`, { method: "PATCH", body: { remove: true } })); }}>Keluarkan</button></>)}</td>}</tr>))}</tbody></table></div>
      )}
      {canManage && invites.length > 0 && (
        <div className="card mt-3"><div className="card-h"><h3>Undangan menunggu</h3></div><div className="table-wrap"><table className="table"><tbody>
          {invites.map((i) => (<tr key={i.id}><td>{i.email}</td><td>{roleLabel(i.role)}</td><td className="muted">s.d. {fmtDate(i.expiresAt)}</td><td className="tr"><button className="btn btn-ghost btn-sm" onClick={() => void act(() => api(`/invitations/${i.id}`, { method: "DELETE" }))}>Cabut</button></td></tr>))}</tbody></table></div></div>
      )}
      {modal && (
        <Modal title="Undang anggota" onClose={() => setModal(false)}>
          {link ? (<div className="stack"><p>Bagikan tautan ini ke yang bersangkutan (mis. lewat WhatsApp). Berlaku 7 hari dan hanya bisa dipakai sekali.</p><input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} /><button className="btn btn-primary btn-block" onClick={() => void copy(link)}>Salin tautan</button></div>) : (
            <form onSubmit={(e) => void invite(e)} className="stack">
              <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required /></div>
              <div className="field"><label htmlFor="role">Peran</label><select id="role" name="role" className="input" defaultValue="WORKER">{myRole === "OWNER" && <option value="MANAGER">Manajer</option>}<option value="WORKER">Petugas kandang</option><option value="VIEWER">Pengamat</option></select></div>
              {err && <div className="alert err" role="alert">{err}</div>}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Membuat…" : "Buat tautan undangan"}</button>
            </form>)}
        </Modal>)}
    </main>
  );
}
