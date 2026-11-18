"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    try { await api("/auth/register", { body: { name: f.get("name"), email: f.get("email"), password: f.get("password"), organizationName: f.get("org") } }); router.replace("/app"); }
    catch (x) { setError(x instanceof ApiFailure ? (x.code === "VALIDATION_ERROR" ? "Periksa isian: kata sandi minimal 8 karakter dan email harus valid." : x.message) : "Tidak bisa terhubung ke server"); }
    finally { setBusy(false); }
  }
  return (
    <AuthShell title="Daftar gratis" sub="Mulai catat ternakmu dalam beberapa menit." foot={<>Sudah punya akun? <Link href="/login">Masuk</Link></>}>
      <form onSubmit={(e) => void onSubmit(e)}>
        {error && <div className="alert err" role="alert"><Icon name="alert" /> {error}</div>}
        <div className="field"><label htmlFor="name">Nama kamu</label><input id="name" name="name" className="input" required minLength={2} autoComplete="name" /></div>
        <div className="field"><label htmlFor="org">Nama usaha / peternakan</label><input id="org" name="org" className="input" required minLength={2} placeholder="contoh: Ternak Makmur" /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required autoComplete="username" /></div>
        <div className="field"><label htmlFor="password">Kata sandi (min. 8 karakter)</label><input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" /></div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <><Spinner /> Membuat akun…</> : "Buat akun"}</button>
      </form>
    </AuthShell>
  );
}
