"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { api } from "@/lib/api";

interface Batch { id: string; code: string; status: string; initialCount: number; currentCount: number }
interface Farm { id: string; name: string; code: string }

export default function HomePage() {
  const [farms, setFarms] = useState<Farm[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<{ data: Farm[] }>("/farms"), api<{ data: Batch[] }>("/batches?status=ACTIVE")])
      .then(([f, b]) => { setFarms(f.data); setBatches(b.data); })
      .catch((e: Error) => setError(e.message));
  }, []);

  const population = batches.reduce((n, b) => n + b.currentCount, 0);

  return (
    <main className="page">
      <div style={{ margin: "4px 0 14px" }}><Logo /></div>
      <h1>Beranda</h1>
      {error && <div className="msg err">{error}</div>}
      <div className="card row">
        <div><div className="muted">Farm</div><div className="num">{farms?.length ?? "–"}</div></div>
        <div><div className="muted">Batch aktif</div><div className="num">{batches.length}</div></div>
        <div><div className="muted">Populasi batch</div><div className="num">{population.toLocaleString("id-ID")}</div></div>
      </div>
      <h2>Batch aktif</h2>
      {farms && batches.length === 0 && <p className="muted">Belum ada batch. Tambahkan di tab Ternak.</p>}
      {batches.map((b) => (
        <div className="card row" key={b.id}>
          <div><strong>{b.code}</strong><div className="muted">Awal {b.initialCount.toLocaleString("id-ID")}</div></div>
          <div className="num">{b.currentCount.toLocaleString("id-ID")}</div>
        </div>
      ))}
    </main>
  );
}
