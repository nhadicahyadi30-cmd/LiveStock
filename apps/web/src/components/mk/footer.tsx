import Link from "next/link";
import { Logo, TAGLINE } from "../logo";

export function SiteFooter() {
  return (
    <footer className="mk-f"><div className="wrap-x">
      <div className="cols">
        <div><Logo tagline /><p className="sm muted mt-2" style={{ maxWidth: 300 }}>{TAGLINE}. Dibuat supaya urusan kandang jadi lebih ringan.</p></div>
        <div><h4>Jelajahi</h4><ul><li><Link href="/produk">Produk</Link></li><li><Link href="/layanan">Layanan</Link></li><li><Link href="/tentang">Tentang kami</Link></li></ul></div>
        <div><h4>Mulai</h4><ul><li><Link href="/login">Masuk ke aplikasi</Link></li><li><Link href="/#cara">Cara kerjanya</Link></li><li><Link href="/#faq">Pertanyaan umum</Link></li></ul></div>
        <div><h4>Proyek</h4><ul><li><a href="https://github.com/nhadicahyadi30-cmd/LiveStock">Kode sumber</a></li></ul></div>
      </div>
      <p className="xs muted mt-3">© {new Date().getFullYear()} Nusa Ternak. Masih tahap pengembangan, fitur ditambah bertahap.</p>
    </div></footer>
  );
}
