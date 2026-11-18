"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HBars, Columns } from "@/components/charts";
import { Icon } from "@/components/icons";
import { useMe } from "@/components/app-shell";
import { Empty, Skeleton, fmt } from "@/components/ui";
import { api } from "@/lib/api";

interface Summary {
  farms: number; activeBatches: number; population: number; mortality30d: number;
  mortalitySeries: { date: string; count: number }[];
  byBatch: { id: string; code: string; population: number }[];
  recent: { id: string; type: "weight" | "mortality"; at: string; label: string; detail: string }[];
}

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
};
const greeting = () => { const h = new Date().getHours(); return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam"; };

export default function DashboardPage() {
  const me = useMe();
  const org = me?.organizations.find((o) => o.id === me.activeOrganizationId);
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<{ data: Summary }>("/dashboard/summary").then((r) => setS(r.data)).catch((e: Error) => setError(e.message)); }, []);

  const kpis = s ? [
    { label: "Total populasi", value: fmt(s.population), sub: "ekor pada batch aktif", icon: "layers" as const, tone: "" },
    { label: "Batch aktif", value: fmt(s.activeBatches), sub: "sedang dipelihara", icon: "grid" as const, tone: "blue" },
    { label: "Farm", value: fmt(s.farms), sub: "lokasi terdaftar", icon: "farm" as const, tone: "amber" },
    { label: "Kematian 30 hari", value: fmt(s.mortality30d), sub: "ekor", icon: "skull" as const, tone: "red" },
  ] : [];

  return (
    <main className="page">
      <div className="page-h">
        <div><h1>{greeting()}{org ? `, ${org.name}` : ""}</h1><p>Ringkasan kondisi peternakan Anda hari ini.</p></div>
        <div className="row"><Link href="/app/catat" className="btn btn-primary"><Icon name="plus" size={18} /> Catat sekarang</Link></div>
      </div>

      {error && <div className="alert err" role="alert"><Icon name="alert" /> {error}</div>}

      <div className="grid g4">
        {s ? kpis.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className="kpi-top">{k.label}<span className={`kpi-ic ${k.tone}`}><Icon name={k.icon} size={18} /></span></div>
            <div className="kpi-v">{k.value}</div><div className="kpi-s">{k.sub}</div>
          </div>
        )) : [0, 1, 2, 3].map((i) => <Skeleton key={i} h={118} />)}
      </div>

      <div className="grid g-main mt-2">
        <div className="card">
          <div className="card-h"><h3>Kematian 30 hari terakhir</h3><span className="badge">{s ? `${fmt(s.mortality30d)} ekor` : "…"}</span></div>
          <div className="card-b">
            {s ? <Columns tone="red" labels={s.mortalitySeries.map((d) => d.date.slice(8) + "/" + d.date.slice(5, 7))} values={s.mortalitySeries.map((d) => d.count)} /> : <Skeleton h={180} />}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Aktivitas terbaru</h3></div>
          <div className="card-b" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {!s ? <Skeleton h={160} /> : s.recent.length === 0 ? <Empty icon="edit" title="Belum ada catatan" text="Catatan bobot dan kematian akan muncul di sini." /> : s.recent.map((r) => (
              <div className="list-item" key={r.id}>
                <span className={`dot-ic ${r.type === "mortality" ? "red" : ""}`}><Icon name={r.type === "weight" ? "scale" : "skull"} size={18} /></span>
                <div className="grow"><div style={{ fontWeight: 600 }}>{r.type === "weight" ? "Bobot" : "Kematian"} · {r.label}</div><div className="xs muted">{r.detail} · {ago(r.at)}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g-main mt-2">
        <div className="card">
          <div className="card-h"><h3>Populasi per batch</h3><Link href="/app/ternak" className="sm">Lihat semua</Link></div>
          <div className="card-b">
            {!s ? <Skeleton h={160} /> : s.byBatch.length === 0
              ? <Empty icon="layers" title="Belum ada batch aktif" text="Tambahkan batch pertama Anda untuk mulai memantau populasi." action={<Link href="/app/ternak" className="btn btn-primary btn-sm">Tambah batch</Link>} />
              : <HBars items={s.byBatch.map((b) => ({ name: b.code, value: b.population }))} />}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Aksi cepat</h3></div>
          <div className="card-b col">
            <Link href="/app/catat?jenis=weight" className="btn btn-secondary"><Icon name="scale" size={18} /> Catat bobot</Link>
            <Link href="/app/catat?jenis=mortality" className="btn btn-secondary"><Icon name="skull" size={18} /> Catat kematian</Link>
            <Link href="/app/ternak" className="btn btn-secondary"><Icon name="plus" size={18} /> Tambah batch</Link>
            <Link href="/app/modul" className="btn btn-ghost"><Icon name="grid" size={18} /> Lihat peta modul</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
