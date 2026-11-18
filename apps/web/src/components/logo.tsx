export const TAGLINE = "Ekosistem Ternak Cerdas untuk Nusantara";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs><clipPath id="nt-c"><rect width="64" height="64" rx="14" /></clipPath></defs>
      <rect width="64" height="64" rx="14" fill="#2f6b3a" />
      <g clipPath="url(#nt-c)"><circle cx="45" cy="62" r="21" fill="#8fc79a" /><circle cx="21" cy="64" r="25" fill="#fff" /></g>
      <path d="M19 22l13-8 13 8" stroke="#e0b04f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <g fill="#e0b04f"><circle cx="19" cy="22" r="3.3" /><circle cx="32" cy="14" r="3.3" /><circle cx="45" cy="22" r="3.3" /></g>
    </svg>
  );
}

export function Logo({ tagline = false }: { tagline?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LogoMark />
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontWeight: 700, fontSize: "1.25rem", letterSpacing: "-0.3px" }}>
          Nusa <span style={{ color: "var(--brand)" }}>Ternak</span>
        </div>
        {tagline && <div className="muted" style={{ fontSize: ".78rem" }}>{TAGLINE}</div>}
      </div>
    </div>
  );
}
