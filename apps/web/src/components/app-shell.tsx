"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiFailure } from "@/lib/api";
import { flushQueue, readQueue } from "@/lib/offline-queue";
import { Icon, type IconName } from "./icons";
import { Logo } from "./logo";
import { Skeleton, ToastProvider, useToast } from "./ui";

export interface Me {
  userId: string;
  activeOrganizationId: string | null;
  organizations: { id: string; name: string; role: string }[];
}
const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx);

const ROLE_LABEL: Record<string, string> = { OWNER: "Pemilik", MANAGER: "Manajer", WORKER: "Petugas kandang", VIEWER: "Pengamat" };
export const roleLabel = (r: string) => ROLE_LABEL[r] ?? r;

type NavItem = { href: string; label: string; icon: IconName };
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Smart Farm", items: [
    { href: "/app", label: "Dashboard", icon: "home" },
    { href: "/app/catat", label: "Catat", icon: "edit" },
    { href: "/app/ternak", label: "Ternak", icon: "layers" },
    { href: "/app/pakan", label: "Pakan", icon: "farm" },
    { href: "/app/produksi", label: "Produksi", icon: "chart" },
    { href: "/app/tugas", label: "Tugas", icon: "check" },
  ] },
  { group: "Kesehatan", items: [{ href: "/app/kesehatan", label: "Kesehatan ternak", icon: "heart" }] },
  { group: "Marketplace", items: [{ href: "/app/pasar", label: "Pasar", icon: "cart" }] },
  { group: "Keuangan", items: [{ href: "/app/keuangan", label: "Keuangan", icon: "coin" }] },
  { group: "Smart Ternak", items: [
    { href: "/app/iot", label: "IoT (sensor kandang)", icon: "cpu" },
    { href: "/app/ai", label: "AI (prediksi)", icon: "spark" },
  ] },
  { group: "Platform", items: [
    { href: "/app/laporan", label: "Laporan", icon: "download" },
    { href: "/app/anggota", label: "Anggota", icon: "users" },
    { href: "/app/modul", label: "Semua modul", icon: "grid" },
  ] },
];
const find = (href: string): NavItem => NAV.flatMap((g) => g.items).find((i) => i.href === href)!;
const BOTTOM = ["/app", "/app/catat", "/app/tugas", "/app/ternak", "/app/modul"].map(find);

interface Notif { id: string; title: string; body: string | null; href: string | null; readAt: string | null }

function Bell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => api<{ data: Notif[]; unread: number }>("/notifications").then((r) => { setItems(r.data); setUnread(r.unread); }).catch(() => undefined);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function read(id?: string) { await api("/notifications/read", { body: id ? { id } : {} }).catch(() => undefined); await load(); }

  return (
    <div className="rel" ref={ref}>
      <button className="icon-btn" aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        <Icon name="bell" />
        {unread > 0 && <span className="pill" style={{ position: "absolute", top: 2, right: 0 }}>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="menu" role="menu" style={{ width: 300, maxHeight: 380, overflowY: "auto" }}>
          <div className="row" style={{ padding: "8px 10px", justifyContent: "space-between" }}><b>Notifikasi</b>{unread > 0 && <button className="btn btn-ghost btn-sm" onClick={() => void read()}>Tandai dibaca</button>}</div>
          <div className="sep" />
          {items.length === 0 && <div className="muted sm" style={{ padding: 12 }}>Belum ada notifikasi.</div>}
          {items.map((n) => (
            <button key={n.id} onClick={() => { void read(n.id); setOpen(false); if (n.href) router.push(n.href); }} style={{ display: "block", textAlign: "left", fontWeight: n.readAt ? 400 : 700 }}>
              <div>{n.title}</div>{n.body && <div className="xs muted">{n.body}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function setTheme(t: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("nt.theme", t); } catch { /* abaikan */ }
}

function Shell({ me, children }: { me: Me; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(false);
  const [pending, setPending] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const org = me.organizations.find((o) => o.id === me.activeOrganizationId);

  useEffect(() => setDark(document.documentElement.getAttribute("data-theme") === "dark"), []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Kirim antrean offline saat halaman dibuka dan setiap koneksi kembali.
  useEffect(() => {
    const sync = () => {
      setPending(readQueue().length);
      void flushQueue().then((r) => {
        setPending(r.remaining);
        if (r.sent > 0) toast({ kind: "ok", title: `${r.sent} catatan offline terkirim` });
      });
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [toast]);

  async function logout() {
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    router.replace("/login");
  }
  async function switchOrg(id: string) {
    await api("/auth/switch-org", { body: { organizationId: id } });
    window.location.href = "/app";
  }

  const active = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  const initials = (org?.name ?? "NT").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <div className="app">
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Navigasi utama">
        <div className="sb-logo"><Link href="/app" style={{ textDecoration: "none", color: "inherit" }}><Logo /></Link></div>
        <nav className="nav">
          {NAV.map((g) => ({ ...g, items: g.items.filter((i) => !(["/app/keuangan", "/app/pasar"].includes(i.href) && org?.role !== "OWNER" && org?.role !== "MANAGER")) })).filter((g) => g.items.length > 0).map((g) => (
            <div className="nav-group" key={g.group}>
              <div className="nav-title">{g.group}</div>
              {g.items.map((i) => (
                <Link key={i.href} href={i.href} className={active(i.href) ? "on" : ""} aria-current={active(i.href) ? "page" : undefined}>
                  <Icon name={i.icon} /> {i.label}
                  {i.href === "/app/catat" && pending > 0 && <span className="pill">{pending}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sb-foot">
          <div className="xs muted">Organisasi aktif</div>
          <div style={{ fontWeight: 700 }}>{org?.name ?? "Belum ada"}</div>
          {org && <div className="xs muted">{roleLabel(org.role)}</div>}
        </div>
      </aside>
      <div className={`scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />

      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Buka menu"><Icon name="menu" /></button>
          <div className="search"><Icon name="search" size={18} /><input className="input" placeholder="Cari batch atau ternak… (buka tab Ternak)" aria-label="Cari" onKeyDown={(e) => { if (e.key === "Enter") router.push(`/app/ternak?q=${encodeURIComponent(e.currentTarget.value)}`); }} /></div>
          <div className="right row" style={{ gap: 4 }}>
            {pending > 0 && <Link href="/app/catat" className="badge warn dot" title="Catatan menunggu dikirim">{pending} menunggu kirim</Link>}
            <Bell />
            <button className="icon-btn" aria-label={dark ? "Mode terang" : "Mode gelap"} onClick={() => { const n = !dark; setDark(n); setTheme(n ? "dark" : "light"); }}><Icon name={dark ? "sun" : "moon"} /></button>
            <div className="rel" ref={menuRef}>
              <button className="avatar" onClick={() => setMenu((m) => !m)} aria-label="Menu akun" aria-expanded={menu}>{initials || "NT"}</button>
              {menu && (
                <div className="menu" role="menu">
                  <div style={{ padding: "8px 10px" }}><div style={{ fontWeight: 700 }}>{org?.name ?? "Akun"}</div><div className="xs muted">{org ? roleLabel(org.role) : ""}</div></div>
                  {me.organizations.length > 1 && (<><div className="sep" />{me.organizations.map((o) => (<button key={o.id} onClick={() => void switchOrg(o.id)}>{o.id === me.activeOrganizationId && <Icon name="check" size={16} />}{o.name}</button>))}</>)}
                  <div className="sep" />
                  <button onClick={() => void logout()}><Icon name="logout" size={18} /> Keluar</button>
                </div>
              )}
            </div>
          </div>
        </header>
        {me.activeOrganizationId === null ? (
          <main className="page"><div className="card card-pad"><h2>Belum ada organisasi</h2><p className="muted mt-1">Akun Anda belum menjadi anggota organisasi mana pun.</p></div></main>
        ) : children}
      </div>

      <nav className="bottom-nav" aria-label="Navigasi cepat">
        {BOTTOM.map((i) => (<Link key={i.href} href={i.href} className={active(i.href) ? "on" : ""}><Icon name={i.icon} />{i.label.replace("Semua ", "")}</Link>))}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<{ data: Me }>("/me")
      .then((r) => setMe(r.data))
      .catch((e) => { if (e instanceof ApiFailure && e.status === 401) router.replace("/login"); });
  }, [router]);

  return (
    <ToastProvider>
      {me ? (
        <MeCtx.Provider value={me}><Shell me={me}>{children}</Shell></MeCtx.Provider>
      ) : (
        <div className="page" style={{ maxWidth: 900 }}><Skeleton h={32} w={220} /><div className="grid g4 mt-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={110} />)}</div></div>
      )}
    </ToastProvider>
  );
}
