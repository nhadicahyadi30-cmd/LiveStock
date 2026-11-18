"use client";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { PILLARS, STATUS_LABEL, type ModuleStatus } from "@/lib/modules";

const ICON: Record<string, IconName> = { platform: "shield", "smart-farm": "farm", kesehatan: "heart", marketplace: "cart", keuangan: "coin", "smart-ternak": "cpu", ai: "spark" };
const BADGE: Record<ModuleStatus, string> = { done: "ok", progress: "warn", planned: "" };

export default function ModulesPage() {
  const [filter, setFilter] = useState<"all" | ModuleStatus>("all");
  const all = PILLARS.flatMap((p) => p.modules);
  const done = all.filter((m) => m.status === "done").length;

  return (
    <main className="page">
      <div className="page-h"><div><h1>Peta modul</h1><p>{done} dari {all.length} modul sudah tersedia. Sisanya dikerjakan bertahap.</p></div>
        <div className="chips">{(["all", "done", "progress", "planned"] as const).map((f) => <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>{f === "all" ? "Semua" : STATUS_LABEL[f]}</button>)}</div></div>
      <div className="grid g2">
        {PILLARS.map((p) => {
          const items = p.modules.filter((m) => filter === "all" || m.status === filter);
          if (items.length === 0) return null;
          const d = p.modules.filter((m) => m.status === "done").length;
          return (
            <section className="card" key={p.id}>
              <div className="card-h"><div className="row"><span className="kpi-ic"><Icon name={ICON[p.id] ?? "grid"} size={18} /></span><div><h3>{p.name}</h3><div className="xs muted">{p.description}</div></div></div><span className="pill">{d}/{p.modules.length}</span></div>
              <div className="card-b" style={{ paddingTop: 12 }}>
                <div className="progress mb-2"><i style={{ width: `${(d / p.modules.length) * 100}%` }} /></div>
                {items.map((m) => (
                  <div className="list-item" key={m.name} style={{ alignItems: "flex-start" }}>
                    <div className="grow"><div style={{ fontWeight: 600 }}>{m.name}</div>{m.note && <div className="xs muted">{m.note}</div>}</div>
                    <span className={`badge ${BADGE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                  </div>))}
              </div>
            </section>);
        })}
      </div>
    </main>
  );
}
