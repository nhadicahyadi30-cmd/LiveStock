import { PILLARS, STATUS_LABEL, type ModuleStatus } from "@/lib/modules";

const COLOR: Record<ModuleStatus, string> = { done: "#2f6b3a", progress: "#b4540a", planned: "#667267" };

export default function ModulesPage() {
  const all = PILLARS.flatMap((p) => p.modules);
  const done = all.filter((m) => m.status === "done").length;

  return (
    <main className="page">
      <h1>Modul</h1>
      <p className="muted">
        {done} dari {all.length} modul sudah tersedia. Sisanya dikerjakan bertahap.
      </p>
      {PILLARS.map((p) => {
        const d = p.modules.filter((m) => m.status === "done").length;
        return (
          <section key={p.id}>
            <h2>
              {p.name} <span className="pill">{d}/{p.modules.length}</span>
            </h2>
            <p className="muted" style={{ marginTop: -4 }}>{p.description}</p>
            {p.modules.map((m) => (
              <div className="card row" key={m.name} style={{ alignItems: "flex-start" }}>
                <div>
                  {m.name}
                  {m.note && <div className="muted">{m.note}</div>}
                </div>
                <span className="pill" style={{ color: COLOR[m.status], whiteSpace: "nowrap" }}>
                  {STATUS_LABEL[m.status]}
                </span>
              </div>
            ))}
          </section>
        );
      })}
    </main>
  );
}
