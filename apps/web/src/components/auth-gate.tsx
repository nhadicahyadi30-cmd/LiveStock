"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiFailure } from "@/lib/api";
import { flushQueue, readQueue } from "@/lib/offline-queue";

export interface Me {
  userId: string;
  activeOrganizationId: string | null;
  organizations: { id: string; name: string; role: string }[];
}

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/catat", label: "Catat" },
  { href: "/ternak", label: "Ternak" },
];

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    api<{ data: Me }>("/me")
      .then((r) => setMe(r.data))
      .catch((e) => {
        if (e instanceof ApiFailure && e.status === 401) router.replace("/login");
      });
  }, [router]);

  // Kirim antrean offline saat halaman dibuka dan setiap koneksi kembali.
  useEffect(() => {
    const sync = () => {
      setPending(readQueue().length);
      void flushQueue().then((r) => setPending(r.remaining));
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  if (!me) return <main className="page muted">Memuat…</main>;

  return (
    <>
      {pending > 0 && <div className="msg warn" style={{ margin: 8 }}>{pending} catatan menunggu dikirim</div>}
      {me.activeOrganizationId === null ? (
        <main className="page">
          <h1>Belum ada organisasi</h1>
          <p className="muted">Akun Anda belum menjadi anggota organisasi mana pun.</p>
        </main>
      ) : (
        children
      )}
      <nav className="bottom">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}>
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
