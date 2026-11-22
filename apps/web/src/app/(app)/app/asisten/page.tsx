"use client";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface Reply { kind: "data" | "knowledge" | "none"; answer: string; link?: { href: string; label: string }; source: string; suggestions: string[] }
interface Turn { q: string; r?: Reply; error?: string }

export default function AsistenPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { api<{ data: { suggestions: string[] } }>("/assistant").then((r) => setSuggest(r.data.suggestions)).catch(() => undefined); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);

  async function ask(q: string) {
    const question = q.trim();
    if (question.length < 2 || busy) return;
    setBusy(true); setText("");
    setTurns((t) => [...t, { q: question }]);
    try {
      const r = await api<{ data: Reply }>("/assistant", { body: { question } });
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, r: r.data } : x)));
    } catch (e) { setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: (e as Error).message } : x))); }
    finally { setBusy(false); }
  }

  return (
    <main className="page">
      <div className="page-h"><div><h1>Asisten peternakan</h1><p>Tanya data usahamu atau hal dasar peternakan.</p></div></div>
      <div className="alert info" style={{ marginBottom: 16 }}>Asisten ini mencocokkan kata kunci, bukan AI percakapan penuh. Jawaban data berasal dari catatanmu; panduan umum berupa kisaran yang perlu disesuaikan. Untuk ternak sakit atau keputusan obat dan vaksin, tanyakan dokter hewan.</div>
      <div className="card card-pad" style={{ minHeight: 280 }}>
        {turns.length === 0 && (<div><p className="sm muted">Coba tanyakan:</p><div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{suggest.map((s) => <button key={s} className="btn btn-secondary btn-sm" onClick={() => void ask(s)}>{s}</button>)}</div></div>)}
        <div style={{ display: "grid", gap: 12 }}>
          {turns.map((t, i) => (
            <div key={i} style={{ display: "grid", gap: 6 }}>
              <div style={{ justifySelf: "end", maxWidth: "85%", background: "var(--brand-soft, #e6f4ea)", borderRadius: 10, padding: "8px 12px" }} className="sm">{t.q}</div>
              <div style={{ justifySelf: "start", maxWidth: "92%", background: "var(--surface-2, #f3f4f6)", borderRadius: 10, padding: "8px 12px" }}>
                {t.error ? <span className="sm" style={{ color: "var(--danger, #c0392b)" }}>{t.error}</span> : !t.r ? <span className="sm muted">Mencari jawaban…</span> : (<>
                  <div className="sm" style={{ whiteSpace: "pre-wrap" }}>{t.r.answer}</div>
                  <div className="xs muted mt-1">{t.r.source}{t.r.link && <> · <Link href={t.r.link.href}>{t.r.link.label}</Link></>}</div>
                  {t.r.suggestions.length > 0 && <div className="row mt-1" style={{ gap: 6, flexWrap: "wrap" }}>{t.r.suggestions.map((s) => <button key={s} className="btn btn-ghost btn-sm" onClick={() => void ask(s)}>{s}</button>)}</div>}
                </>)}
              </div>
            </div>))}
          <div ref={end} />
        </div>
      </div>
      <form className="row mt-2" style={{ gap: 8 }} onSubmit={(e: FormEvent) => { e.preventDefault(); void ask(text); }}>
        <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Tulis pertanyaan…" aria-label="Pertanyaan" />
        <button className="btn btn-primary" disabled={busy || text.trim().length < 2}>Kirim</button>
      </form>
    </main>
  );
}
