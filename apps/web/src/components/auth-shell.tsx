import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";

export function AuthShell({ title, sub, children, foot }: { title: string; sub?: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="login-wrap" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      <main className="login-form">
        <div className="login-card">
          <div className="mb-3"><Link href="/" style={{ textDecoration: "none", color: "inherit" }}><Logo /></Link></div>
          <h1 style={{ fontSize: 26 }}>{title}</h1>
          {sub && <p className="muted mt-1 mb-3">{sub}</p>}
          {children}
          {foot && <p className="sm muted mt-3">{foot}</p>}
        </div>
      </main>
    </div>
  );
}
