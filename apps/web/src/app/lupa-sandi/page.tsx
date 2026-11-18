"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

export default function ForgotPage() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ devLink?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    try { const r = await api<{ data: { devLink?: string } }>("/auth/forgot", { body: { email: new FormData(e.currentTarget).get("email") } }); setDone(r.data); }
    catch (x) { setError(x instanceof ApiFailure ? x.message : "Tidak bisa terhubung ke server"); } finally { setBusy(false); }
  }
  return (
    <AuthShell title="Lupa kata sandi?" sub="Masukkan emailmu, kami buatkan tautan untuk mengatur ulang." foot={<Link href="/login">Kembali ke halaman masuk</Link>}>
      {done ? (
        <div className="alert info"><Icon name="info" /> <div>Kalau email terdaftar, tautan pengaturan ulang sudah dibuat (berlaku 1 jam).
          {done.devLink && <div className="mt-1"><b>Mode pengembangan:</b> <Link href={done.devLink.replace(/^https?:\/\/[^/]+/, "")}>buka tautan reset</Link></div>}</div></div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)}>
          {error && <div className="alert err" role="alert"><Icon name="alert" /> {error}</div>}
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required /></div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <><Spinner /> Memproses…</> : "Kirim tautan"}</button>
        </form>
      )}
    </AuthShell>
  );
}
