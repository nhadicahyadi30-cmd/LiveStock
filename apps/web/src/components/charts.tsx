// Grafik SVG ringan tanpa dependensi. Warna mengikuti token CSS sehingga ikut mode gelap.
import { fmt } from "./ui";

export function HBars({ items }: { items: { name: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      {items.map((i) => (
        <div className="hbar" key={i.name}>
          <span className="name" title={i.name}>{i.name}</span>
          <div className="progress"><i style={{ width: `${(i.value / max) * 100}%` }} /></div>
          <span className="val">{fmt(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Kolom per hari/kategori. labels dan values sama panjang. */
export function Columns({ labels, values, tone = "brand", height = 180 }: { labels: string[]; values: number[]; tone?: "brand" | "red"; height?: number }) {
  const W = 600, padL = 30, padB = 22, padT = 8;
  const max = Math.max(1, ...values);
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const bw = (W - padL) / Math.max(1, values.length);
  const H = height;
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / nice);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik kolom">
      {[0, 1, 2, 3, 4].map((t) => {
        const v = (nice / 4) * t;
        return (<g key={t}><line className="grid-l" x1={padL} x2={W} y1={y(v)} y2={y(v)} /><text x={padL - 6} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text></g>);
      })}
      {values.map((v, i) => (
        <g key={i}>
          <rect className={`bar ${tone === "red" ? "red" : ""}`} x={padL + i * bw + bw * 0.18} width={bw * 0.64} y={y(v)} height={Math.max(0, H - padB - y(v))} rx={3}><title>{`${labels[i] ?? ""}: ${fmt(v)}`}</title></rect>
          {(values.length <= 12 || i % Math.ceil(values.length / 8) === 0) && <text x={padL + i * bw + bw / 2} y={H - 6} textAnchor="middle">{labels[i]}</text>}
        </g>
      ))}
    </svg>
  );
}

/** Garis dengan area. points: urutan nilai; labels: label sumbu x. */
export function Line({ labels, values, height = 180, unit = "" }: { labels: string[]; values: number[]; height?: number; unit?: string }) {
  const W = 600, padL = 36, padB = 22, padT = 10, H = height;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => padL + (values.length <= 1 ? (W - padL) / 2 : (i / (values.length - 1)) * (W - padL - 8));
  const y = (v: number) => padT + (H - padB - padT) * (1 - (v - min) / span);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = values.length ? `${d} L${x(values.length - 1).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB} Z` : "";
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik garis">
      <defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--brand)" stopOpacity=".28" /><stop offset="1" stopColor="var(--brand)" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map((t) => { const v = min + (span / 3) * t; return (<g key={t}><line className="grid-l" x1={padL} x2={W} y1={y(v)} y2={y(v)} /><text x={padL - 6} y={y(v) + 4} textAnchor="end">{Math.round(v * 10) / 10}</text></g>); })}
      {area && <path d={area} fill="url(#lg)" />}
      {d && <path d={d} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {values.map((v, i) => (<g key={i}><circle cx={x(i)} cy={y(v)} r={4} fill="var(--surface)" stroke="var(--brand)" strokeWidth={2}><title>{`${labels[i] ?? ""}: ${v}${unit}`}</title></circle>{(values.length <= 8 || i % Math.ceil(values.length / 6) === 0) && <text x={x(i)} y={H - 6} textAnchor="middle">{labels[i]}</text>}</g>))}
    </svg>
  );
}
