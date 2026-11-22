"use client";
import { useCallback, useEffect, useState } from "react";
import { Modal, Skeleton, fmt, fmtDate, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";

export const CAT: Record<string, string> = { LIVESTOCK: "Ternak", FEED: "Pakan", MEDICINE: "Obat & vitamin", EQUIPMENT: "Peralatan", PRODUCE: "Hasil ternak", KURBAN: "Kurban", AQIQAH: "Aqiqah", SERVICE: "Layanan" };
/** Kategori pesan di muka (butuh tanggal dibutuhkan). */
export const PREORDER = ["KURBAN", "AQIQAH", "SERVICE"];
export const ANIMALS: Record<string, string> = { SAPI: "Sapi", KAMBING: "Kambing", DOMBA: "Domba" };
export const SERVICE_TYPES: Record<string, string> = { PENYEMBELIHAN: "Penyembelihan", PEMOTONGAN_PENGEMASAN: "Pemotongan dan pengemasan", PENGANTARAN: "Pengantaran", PENITIPAN: "Penitipan hewan", PEMBAGIAN_DAGING: "Pembagian daging", LAINNYA: "Lainnya" };
export interface ListingAttrs { animal?: string; weightKg?: number; ageMonths?: number; slaughter?: boolean; delivery?: boolean; area?: string; shares?: number; serviceType?: string }

/** Ringkasan rincian kurban/aqiqah/layanan sebagai daftar label pendek. */
export function attrLabels(a: ListingAttrs | null | undefined): string[] {
  if (!a) return [];
  const out: string[] = [];
  if (a.serviceType) out.push(SERVICE_TYPES[a.serviceType] ?? a.serviceType);
  if (a.animal) out.push(ANIMALS[a.animal] ?? a.animal);
  if (a.weightKg) out.push(`± ${fmt(a.weightKg)} kg`);
  if (a.ageMonths) out.push(`${a.ageMonths} bulan`);
  if (a.shares && a.shares > 1) out.push(`Patungan 1/${a.shares}`);
  if (a.slaughter) out.push("Termasuk penyembelihan");
  if (a.delivery) out.push("Bisa diantar");
  if (a.area) out.push(`Area: ${a.area}`);
  return out;
}
export function AttrChips({ attrs }: { attrs: ListingAttrs | null | undefined }) {
  const l = attrLabels(attrs);
  return l.length ? <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>{l.map((x) => <span key={x} className="badge">{x}</span>)}</div> : null;
}
export const rp = (n: number) => `Rp ${fmt(Math.round(n))}`;
export const wa = (p: string) => `https://wa.me/${p.replace(/[^0-9]/g, "").replace(/^0/, "62")}`;
export const MAX_PHOTOS = 4;

export interface MarketListingLite { id: string; attributes?: ListingAttrs | null; title: string; category: string; unit: string; priceIdr: number; stock: number; images: string[] }

/** Mengecilkan foto di peramban (maks. 1200 px, JPEG) agar di bawah 700 KB sebelum diunggah. */
export async function shrinkImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Peramban tidak mendukung pengolahan gambar");
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= 700 * 1024) return blob;
  }
  throw new Error("Foto terlalu besar; pilih foto lain");
}

export async function uploadListingPhoto(listingId: string, file: File): Promise<void> {
  const blob = await shrinkImage(file);
  const res = await fetch(`/api/v1/market/listings/${listingId}/images`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(j?.error?.message ?? "Gagal mengunggah foto");
  }
}

export function Photo({ id, alt, ratio = "4 / 3", radius = 10 }: { id?: string | undefined; alt: string; ratio?: string; radius?: number }) {
  const box = { width: "100%", aspectRatio: ratio, borderRadius: radius, overflow: "hidden", background: "var(--line, #e5e7eb)", display: "block" } as const;
  if (!id) return <div style={{ ...box, display: "grid", placeItems: "center", color: "var(--muted, #6b7280)", fontSize: 12 }}>Belum ada foto</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/v1/market/images/${id}`} alt={alt} loading="lazy" style={{ ...box, objectFit: "cover" }} />;
}

function Stars({ avg, count }: { avg: number; count: number }) {
  return count ? <span>★ {avg.toFixed(1)} <span className="muted">({count} ulasan)</span></span> : <span className="muted">Belum ada ulasan</span>;
}

interface Vendor { orgId: string; name: string; city: string; phone: string; about: string | null; isMe: boolean; rating: { avg: number; count: number }; reviews: { id: string; rating: number; comment: string | null; createdAt: string }[]; listings: MarketListingLite[] }

/** Profil publik penjual: toko, rating, ulasan, dan semua produk yang tayang. */
export function SellerModal({ orgId, onClose, onProduct }: { orgId: string; onClose: () => void; onProduct: (id: string) => void }) {
  const [v, setV] = useState<Vendor | null | undefined>(undefined);
  useEffect(() => { api<{ data: Vendor }>(`/market/vendors/${orgId}`).then((r) => setV(r.data)).catch(() => setV(null)); }, [orgId]);
  return (
    <Modal title="Profil penjual" onClose={onClose}>
      {v === undefined ? <Skeleton h={160} /> : v === null ? <p className="muted">Profil toko tidak ditemukan.</p> : (
        <div className="stack">
          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--brand, #1a6b3c)", color: "#fff", display: "grid", placeItems: "center", fontSize: 22, fontWeight: 700, flex: "none" }}>{v.name.slice(0, 1).toUpperCase()}</div>
            <div><h3 style={{ margin: 0 }}>{v.name}{v.isMe && <span className="badge" style={{ marginLeft: 8 }}>Tokomu</span>}</h3><div className="xs muted">{v.city} · <Stars {...v.rating} /></div></div>
          </div>
          {v.about && <p className="sm">{v.about}</p>}
          {!v.isMe && <a className="btn btn-secondary btn-sm" href={wa(v.phone)} target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start" }}>Hubungi via WhatsApp ({v.phone})</a>}
          <h4 style={{ margin: "8px 0 0" }}>Produk ({v.listings.length})</h4>
          {v.listings.length === 0 ? <p className="muted sm">Belum ada produk yang tayang.</p> : (
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
              {v.listings.map((l) => (
                <button key={l.id} type="button" onClick={() => onProduct(l.id)} style={{ textAlign: "left", background: "none", border: "1px solid var(--line, #e5e7eb)", borderRadius: 12, padding: 8, cursor: "pointer" }}>
                  <Photo id={l.images[0]} alt={l.title} />
                  <div className="sm" style={{ fontWeight: 600, marginTop: 6 }}>{l.title}</div>
                  <div className="xs">{rp(l.priceIdr)} / {l.unit}</div>
                </button>))}
            </div>)}
          <h4 style={{ margin: "8px 0 0" }}>Ulasan pembeli</h4>
          {v.reviews.length === 0 ? <p className="muted sm">Belum ada ulasan.</p> : v.reviews.map((r) => (
            <div key={r.id} className="sm" style={{ borderTop: "1px solid var(--line, #e5e7eb)", paddingTop: 8 }}>{"★".repeat(r.rating)}<span className="muted">{"★".repeat(5 - r.rating)}</span> <span className="xs muted">{fmtDate(r.createdAt)}</span>{r.comment && <div>“{r.comment}”</div>}</div>))}
        </div>)}
    </Modal>
  );
}

export interface ProductDetail extends MarketListingLite { description: string | null; sellerOrgId: string; isMine: boolean; seller: { name: string; city: string; phone: string; rating: { avg: number; count: number } } }

/** Detail produk dengan galeri foto dan tautan ke profil penjual. */
export function ProductModal({ p, onClose, onOrder, onSeller }: { p: ProductDetail; onClose: () => void; onOrder: () => void; onSeller: () => void }) {
  const [i, setI] = useState(0);
  return (
    <Modal title={p.title} onClose={onClose}>
      <div className="stack">
        <Photo id={p.images[i]} alt={p.title} ratio="4 / 3" />
        {p.images.length > 1 && <div className="row" style={{ gap: 6 }}>{p.images.map((id, k) => <button key={id} type="button" onClick={() => setI(k)} aria-label={`Foto ${k + 1}`} style={{ width: 64, padding: 0, border: k === i ? "2px solid var(--brand, #1a6b3c)" : "2px solid transparent", borderRadius: 8, background: "none", cursor: "pointer" }}><Photo id={id} alt="" radius={6} /></button>)}</div>}
        <span className="badge" style={{ alignSelf: "flex-start" }}>{CAT[p.category]}</span>
        <AttrChips attrs={p.attributes} />
        <div style={{ fontSize: 24, fontWeight: 700 }}>{rp(p.priceIdr)} <span className="muted sm">/ {p.unit}</span></div>
        <div className="sm muted">Stok {fmt(p.stock)} {p.unit}</div>
        {p.description && <p className="sm">{p.description}</p>}
        <button type="button" onClick={onSeller} className="sm" style={{ textAlign: "left", background: "none", border: "1px solid var(--line, #e5e7eb)", borderRadius: 12, padding: 12, cursor: "pointer" }}>
          <b>{p.seller.name}</b>{p.seller.city ? `, ${p.seller.city}` : ""}<br /><span className="xs"><Stars {...p.seller.rating} /> · Lihat profil dan produk lainnya →</span>
        </button>
        {PREORDER.includes(p.category) && <div className="alert">Pesan di muka: Anda akan memilih tanggal dibutuhkan saat memesan.</div>}
        {p.isMine ? <div className="alert">Ini produk milik tokomu.</div> : <button className="btn btn-primary btn-block" onClick={onOrder}>Pesan</button>}
      </div>
    </Modal>
  );
}

/** Kelola foto produk milik sendiri: lihat, hapus, tambah (maks. 4). */
export function PhotoManager({ listing, onClose, onChanged }: { listing: MarketListingLite; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [ids, setIds] = useState<string[]>(listing.images);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const r = await api<{ data: { id: string; images: string[] }[] }>("/market/listings?scope=mine");
    setIds(r.data.find((x) => x.id === listing.id)?.images ?? []);
    onChanged();
  }, [listing.id, onChanged]);
  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(files).slice(0, MAX_PHOTOS - ids.length)) await uploadListingPhoto(listing.id, f);
      await refresh(); toast({ kind: "ok", title: "Foto ditambahkan" });
    } catch (x) { toast({ kind: "err", title: x instanceof Error ? x.message : "Gagal mengunggah" }); }
    finally { setBusy(false); }
  }
  async function del(id: string) {
    setBusy(true);
    try { await api(`/market/images/${id}`, { method: "DELETE" }); await refresh(); }
    catch (x) { toast({ kind: "err", title: x instanceof ApiFailure ? x.message : "Gagal menghapus" }); }
    finally { setBusy(false); }
  }
  return (
    <Modal title={`Foto: ${listing.title}`} onClose={onClose}>
      <div className="stack">
        <p className="sm muted">Foto pertama menjadi foto utama. Maksimal {MAX_PHOTOS} foto; ukuran dikecilkan otomatis.</p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {ids.map((id, k) => (<div key={id}><Photo id={id} alt={`Foto ${k + 1}`} /><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void del(id)}>Hapus{k === 0 ? " (utama)" : ""}</button></div>))}
        </div>
        {ids.length < MAX_PHOTOS && <label className="btn btn-secondary btn-block" style={{ cursor: "pointer", textAlign: "center" }}>{busy ? "Mengunggah…" : "Tambah foto"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={busy} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} /></label>}
      </div>
    </Modal>
  );
}
