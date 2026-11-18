"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { fmt } from "@/components/ui";
import { api } from "@/lib/api";

interface Batch { id: string; code: string; status: string; startDate: string; initialCount: number; currentCount: number }
const EXPORTS: [string, string, string][] = [
  ["population", "Populasi per batch", "Ringkasan populasi awal dan saat ini."],
  ["weight", "Catatan bobot", "Semua penimbangan yang masih berlaku."],
  ["mortality", "Catatan kematian", "Tanggal, jumlah, dan penyebab."],
  ["feed", "Catatan pakan", "Jenis, jumlah, dan biaya pakan."],
  ["production", "Catatan produksi", "Telur, susu, dan panen."],
];

export default function LaporanPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  useEffect(() => { api<{ data: Batch[] }>("/batches?limit=100").then((r) => setBatches(r.data)).catch(() => undefined); }, []);
  const total = batches.reduce((n, b) => n + b.currentCount, 0);

  return (
    <main className="page">
      <div className="page-h no-print"><div><h1>Laporan</h1><p>Unduh data sebagai file CSV (bisa dibuka di Excel) atau cetak ringkasan sebagai PDF.</p></div>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="download" size={18} /> Cetak / simpan PDF</button></div>

      <div className="grid g3 no-print">
        {EXPORTS.map(([t, name, desc]) => (
          <div className="card card-pad" key={t}><h3>{name}</h3><p className="muted sm mt-1">{desc}</p>
            <a className="btn btn-secondary btn-sm mt-2" href={`/api/v1/reports/export?type=${t}`} download><Icon name="download" size={16} /> Unduh CSV</a></div>
        ))}
      </div>

      <div className="card mt-3">
        <div className="card-h"><h3>Ringkasan populasi · {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</h3><span className="badge">{fmt(total)} ekor</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Batch</th><th>Status</th><th>Mulai</th><th className="num">Awal</th><th className="num">Sekarang</th></tr></thead>
          <tbody>{batches.map((b) => (<tr key={b.id}><td>{b.code}</td><td>{b.status === "ACTIVE" ? "Aktif" : "Ditutup"}</td><td>{new Date(b.startDate).toLocaleDateString("id-ID")}</td><td className="num">{fmt(b.initialCount)}</td><td className="num">{fmt(b.currentCount)}</td></tr>))}</tbody></table></div>
      </div>
    </main>
  );
}
