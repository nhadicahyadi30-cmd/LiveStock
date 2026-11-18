"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/components/app-shell";
import { Logo } from "@/components/logo";
import { Skeleton, fmt, fmtDate } from "@/components/ui";
import { api } from "@/lib/api";

interface Invoice { id: string; number: string; customerName: string; customerContact: string | null; issueOn: string; dueOn: string; description: string | null; amount: number; status: "OPEN" | "PAID" | "VOID"; paidOn: string | null }

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const org = me?.organizations.find((o) => o.id === me.activeOrganizationId);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<{ data: Invoice[] }>("/finance/invoices").then((r) => { const f = r.data.find((i) => i.id === id); if (f) setInv(f); else setError("Invoice tidak ditemukan"); }).catch((e: Error) => setError(e.message)); }, [id]);

  if (error) return <main className="page"><div className="alert err">{error}</div><Link href="/app/keuangan" className="btn btn-secondary">Kembali</Link></main>;
  if (!inv) return <main className="page"><Skeleton h={300} /></main>;
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="row no-print" style={{ justifyContent: "space-between", marginBottom: 12 }}><Link href="/app/keuangan" className="btn btn-ghost">← Kembali</Link><button className="btn btn-primary" onClick={() => window.print()}>Cetak / simpan PDF</button></div>
      <div className="card card-pad">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><Logo /><div className="sm muted mt-1">{org?.name}</div></div>
          <div style={{ textAlign: "right" }}><h1 style={{ fontSize: 26 }}>INVOICE</h1><div style={{ fontWeight: 700 }}>{inv.number}</div><div className="sm"><b>{inv.status === "PAID" ? "LUNAS" : inv.status === "VOID" ? "DIBATALKAN" : "BELUM LUNAS"}</b></div></div>
        </div>
        <div className="grid g2 mt-3">
          <div><div className="xs muted">Ditagihkan kepada</div><div style={{ fontWeight: 600 }}>{inv.customerName}</div>{inv.customerContact && <div className="sm">{inv.customerContact}</div>}</div>
          <div style={{ textAlign: "right" }}><div className="sm">Terbit: {fmtDate(inv.issueOn)}</div><div className="sm">Jatuh tempo: {fmtDate(inv.dueOn)}</div>{inv.paidOn && <div className="sm">Dibayar: {fmtDate(inv.paidOn)}</div>}</div>
        </div>
        <table className="table mt-3"><thead><tr><th>Keterangan</th><th className="num">Jumlah</th></tr></thead><tbody><tr><td>{inv.description ?? "Penjualan"}</td><td className="num">Rp {fmt(inv.amount)}</td></tr><tr><td style={{ fontWeight: 700 }}>Total</td><td className="num" style={{ fontWeight: 700 }}>Rp {fmt(inv.amount)}</td></tr></tbody></table>
        <p className="xs muted mt-3">Dibuat dengan Nusa Ternak.</p>
      </div>
    </main>
  );
}
