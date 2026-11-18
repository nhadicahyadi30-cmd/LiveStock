"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Logo, TAGLINE } from "@/components/logo";
import { Spinner } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      await api("/auth/login", { body: { email: f.get("email"), password: f.get("password") } });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : "Tidak bisa terhubung ke server");
    } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <aside className="login-side">
        <div style={{ color: "#fff" }}><Logo light /></div>
        <div>
          <h2 style={{ fontSize: 32, letterSpacing: "-0.02em", marginBottom: 12 }}>{TAGLINE}</h2>
          <p style={{ opacity: .85, marginBottom: 28, fontSize: 17 }}>Catat, pantau, dan kembangkan usaha ternak Anda dalam satu platform.</p>
          <ul><li><Icon name="wifiOff" /> Tetap bisa mencatat tanpa internet</li><li><Icon name="shield" /> Data usaha Anda terpisah dan aman</li><li><Icon name="chart" /> Dashboard populasi dan tren bobot</li></ul>
        </div>
        <div className="xs" style={{ opacity: .7 }}>© {new Date().getFullYear()} Nusa Ternak</div>
      </aside>
      <main className="login-form">
        <div className="login-card">
          <div className="mb-3 login-mobile-logo"><Link href="/" style={{ textDecoration: "none", color: "inherit" }}><Logo /></Link></div>
          <h1 style={{ fontSize: 26 }}>Masuk ke akun Anda</h1>
          <p className="muted mt-1 mb-3">Gunakan email dan kata sandi yang terdaftar.</p>
          <form onSubmit={onSubmit}>
            {error && <div className="alert err" role="alert"><Icon name="alert" /> {error}</div>}
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" className="input" required placeholder="nama@usaha.com" /></div>
            <div className="field"><label htmlFor="password">Kata sandi</label>
              <div className="rel"><input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" className="input" required style={{ paddingRight: 70 }} />
                <button type="button" className="btn btn-ghost btn-sm" style={{ position: "absolute", right: 4, top: 5 }} onClick={() => setShow((s) => !s)}>{show ? "Sembunyi" : "Lihat"}</button></div></div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <><Spinner /> Memproses…</> : "Masuk"}</button>
          </form>
          <p className="sm mt-3"><Link href="/lupa-sandi">Lupa kata sandi?</Link></p>
          <p className="sm muted mt-1">Belum punya akun? <Link href="/register">Daftar gratis</Link></p>
          <p className="sm muted mt-1"><Link href="/"><Icon name="arrowLeft" size={14} /> Kembali ke beranda</Link></p>
        </div>
      </main>
    </div>
  );
}
