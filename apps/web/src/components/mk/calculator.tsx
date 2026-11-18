"use client";
import { useState } from "react";

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

/** Kalkulator sederhana: perkiraan nilai yang hilang akibat kematian ternak. */
export function LossCalculator() {
  const [n, setN] = useState(5000);
  const [pct, setPct] = useState(4);
  const [price, setPrice] = useState(45000);
  const dead = Math.round((n * pct) / 100);
  const loss = dead * price;
  const perPoint = (n * 1 * price) / 100;

  return (
    <div className="calc glass-l">
      <div className="calc-in">
        <div className="field"><label htmlFor="c-n">Jumlah ternak (ekor)</label><input id="c-n" className="input" type="number" min={0} inputMode="numeric" value={n} onChange={(e) => setN(Math.max(0, Number(e.target.value)))} /></div>
        <div className="field"><label htmlFor="c-p">Perkiraan kematian: <b>{pct}%</b></label><input id="c-p" type="range" min={0} max={30} step={0.5} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--brand)" }} /></div>
        <div className="field"><label htmlFor="c-h">Perkiraan nilai per ekor (Rp)</label><input id="c-h" className="input" type="number" min={0} inputMode="numeric" value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))} /></div>
      </div>
      <div className="calc-out">
        <div className="xs" style={{ opacity: .8 }}>Perkiraan nilai yang hilang</div>
        <div className="calc-big">{rp(loss)}</div>
        <div className="sm" style={{ opacity: .9 }}>dari <b>{dead.toLocaleString("id-ID")}</b> ekor yang mati.</div>
        <div className="calc-note">Tiap 1% kematian setara sekitar <b>{rp(perPoint)}</b>. Makanya kematian sebaiknya dicatat tiap hari, biar kelihatan sejak awal dan bisa langsung dicari penyebabnya.</div>
        <div className="xs" style={{ opacity: .6, marginTop: 10 }}>Hitungan kasar untuk ilustrasi, bukan prediksi.</div>
      </div>
    </div>
  );
}
