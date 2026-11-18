"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

function Form() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api("/auth/reset", { body: { token, password: new FormData(e.currentTarget).get("password") } }); router.replace("/login"); }
    catch (x) { setError(x instanceof ApiFailure ? (x.code === "VALIDATION_ERROR" ? "Kata sandi minimal 8 karakter." : x.message) : "Tidak bisa terhubung ke server"); } finally { setBusy(false); }
  }
  return (
    <AuthShell title="Atur kata sandi baru" foot={<Link href="/login">Kembali ke halaman masuk</Link>}>
      <form onSubmit={(e) => void onSubmit(e)}>
        {error && <div className="alert err" role="alert"><Icon name="alert" /> {error}</div>}
        <div className="field"><label htmlFor="password">Kata sandi baru (min. 8 karakter)</label><input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" /></div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !token}>{busy ? <><Spinner /> Menyimpan…</> : "Simpan kata sandi"}</button>
      </form>
    </AuthShell>
  );
}
export default function ResetPage() { return <Suspense><Form /></Suspense>; }
