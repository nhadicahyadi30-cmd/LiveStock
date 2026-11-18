"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

const ROLE: Record<string, string> = { MANAGER: "Manajer", WORKER: "Petugas kandang", VIEWER: "Pengamat" };

function Form() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [info, setInfo] = useState<{ email: string; role: string; hasAccount: boolean } | null>(null);
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<{ data: { email: string; role: string; hasAccount: boolean } }>(`/auth/accept-invite?token=${encodeURIComponent(token)}`).then((r) => setInfo(r.data)).catch(() => setBad(true)); }, [token]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    try { await api("/auth/accept-invite", { body: { token, name: f.get("name") || undefined, password: f.get("password") } }); router.replace("/app"); }
    catch (x) { setError(x instanceof ApiFailure ? (x.code === "VALIDATION_ERROR" ? "Periksa isian: kata sandi minimal 8 karakter." : x.message) : "Tidak bisa terhubung ke server"); } finally { setBusy(false); }
  }
  if (bad) return <AuthShell title="Undangan tidak berlaku" sub="Tautan sudah dipakai atau kedaluwarsa. Minta pengundang membuat yang baru." foot={<Link href="/login">Ke halaman masuk</Link>}><span /></AuthShell>;
  if (!info) return <AuthShell title="Memuat undangan…"><Spinner /></AuthShell>;
  return (
    <AuthShell title="Gabung ke tim" sub={`Kamu diundang sebagai ${ROLE[info.role] ?? info.role} dengan email ${info.email}.`}>
      <form onSubmit={(e) => void onSubmit(e)}>
        {error && <div className="alert err" role="alert"><Icon name="alert" /> {error}</div>}
        {!info.hasAccount && <div className="field"><label htmlFor="name">Nama kamu</label><input id="name" name="name" className="input" required minLength={2} /></div>}
        <div className="field"><label htmlFor="password">{info.hasAccount ? "Kata sandi akunmu" : "Buat kata sandi (min. 8 karakter)"}</label><input id="password" name="password" type="password" className="input" required minLength={info.hasAccount ? 1 : 8} /></div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <><Spinner /> Memproses…</> : "Terima undangan"}</button>
      </form>
    </AuthShell>
  );
}
export default function InvitePage() { return <Suspense><Form /></Suspense>; }
