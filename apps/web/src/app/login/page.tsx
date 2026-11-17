"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiFailure } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { body: { email: f.get("email"), password: f.get("password") } });
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : "Tidak bisa terhubung ke server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>Masuk</h1>
      <form className="card" onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Kata sandi</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        {error && <div className="msg err" role="alert">{error}</div>}
        <div style={{ marginTop: 14 }}>
          <button type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? "Memproses…" : "Masuk"}</button>
        </div>
      </form>
    </main>
  );
}
