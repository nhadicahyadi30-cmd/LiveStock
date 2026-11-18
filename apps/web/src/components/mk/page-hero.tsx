import type { ReactNode } from "react";

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="hero-dark inner"><div className="aurora" aria-hidden="true" /><div className="gridbg" aria-hidden="true" />
      <div className="wrap-x" style={{ position: "relative" }}>
        <span className="eyebrow dark">{eyebrow}</span>
        <h1>{title}</h1>
        {children && <p className="lead">{children}</p>}
      </div>
    </section>
  );
}
