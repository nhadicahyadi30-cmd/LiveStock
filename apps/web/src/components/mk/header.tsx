"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { Logo } from "../logo";

const LINKS = [{ href: "/produk", label: "Produk" }, { href: "/layanan", label: "Layanan" }, { href: "/tentang", label: "Tentang kami" }];

export function SiteHeader() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 12);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  useEffect(() => setOpen(false), [path]);

  return (
    <header className={`sx-h ${scrolled || open ? "solid" : ""}`}>
      <div className="in">
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }} aria-label="Nusa Ternak, beranda"><Logo light={!(scrolled || open)} /></Link>
        <nav className="sx-nav" aria-label="Menu utama">
          {LINKS.map((l) => <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>{l.label}</Link>)}
        </nav>
        <div className="right row">
          <Link href="/login" className="btn btn-ghost sx-login">Masuk</Link>
          <Link href="/login" className="btn btn-primary sx-cta">Coba sekarang</Link>
          <button className="icon-btn sx-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}><Icon name={open ? "x" : "menu"} /></button>
        </div>
      </div>
      {open && (
        <div className="sx-drawer">
          {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          <Link href="/login" className="btn btn-primary btn-block mt-1">Masuk / Coba sekarang</Link>
        </div>
      )}
    </header>
  );
}
