"use client";
import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { CountUp, Tilt } from "./fx";

const BATCHES = [["Broiler B-07", 4200], ["Layer L-02", 3600], ["Lele K-11", 2800], ["Sapi S-03", 1880]] as const;

/** Tampilan dashboard contoh. Angka sensor bergerak sebagai SIMULASI, bukan data sungguhan. */
export function HeroMock() {
  const [t, setT] = useState({ suhu: 28.4, lembap: 71, amonia: 9 });
  const [grow, setGrow] = useState(false);
  useEffect(() => {
    setGrow(true);
    const i = setInterval(() => setT((x) => ({
      suhu: Math.round((27.5 + Math.random() * 2.2) * 10) / 10,
      lembap: Math.round(68 + Math.random() * 6),
      amonia: Math.round(7 + Math.random() * 5),
    })), 2000);
    return () => clearInterval(i);
  }, []);

  return (
    <Tilt className="hm">
      <div className="glass hm-card" aria-hidden="true">
        <div className="row between mb-2"><b>Dashboard</b><span className="live"><i /> Simulasi langsung</span></div>
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="gl-kpi"><span>Total populasi</span><b><CountUp to={12480} /></b></div>
          <div className="gl-kpi"><span>Batch aktif</span><b><CountUp to={8} /></b></div>
        </div>
        <div className="mt-2">
          {BATCHES.map(([n, v], i) => (
            <div className="hbar gl-bar" key={n}><span className="name">{n}</span><div className="progress"><i style={{ width: grow ? `${(v / 4200) * 100}%` : 0, transitionDelay: `${i * 120}ms` }} /></div><span className="val">{v.toLocaleString("id-ID")}</span></div>
          ))}
        </div>
        <div className="sensors mt-2">
          <div><Icon name="cpu" size={16} /><span>Suhu</span><b>{t.suhu}°C</b></div>
          <div><Icon name="cpu" size={16} /><span>Lembap</span><b>{t.lembap}%</b></div>
          <div><Icon name="cpu" size={16} /><span>Amonia</span><b>{t.amonia} ppm</b></div>
        </div>
      </div>
      <div className="glass hm-chip c1"><Icon name="check" size={16} /> Catatan offline terkirim</div>
      <div className="glass hm-chip c2"><Icon name="spark" size={16} /> Bobot naik 4,2% minggu ini</div>
    </Tilt>
  );
}
