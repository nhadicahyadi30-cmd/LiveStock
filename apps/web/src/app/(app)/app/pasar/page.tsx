"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useMe } from "@/components/app-shell";
import { Empty, Modal, Skeleton, fmt, fmtDate, useToast } from "@/components/ui";
import { PaymentModal } from "@/components/payment-panel";
import { ShipmentModal } from "@/components/shipment-panel";
import { AttrChips, ANIMALS, CAT, PREORDER, SERVICE_TYPES, PhotoManager, Photo, ProductModal, SellerModal, uploadListingPhoto, MAX_PHOTOS, type ListingAttrs, type ProductDetail } from "@/components/market-parts";
import { api, ApiFailure } from "@/lib/api";

interface Listing { id: string; attributes: ListingAttrs | null; sellerOrgId: string; isMine: boolean; images: string[]; title: string; category: string; description: string | null; unit: string; status: string; priceIdr: number; stock: number; seller: { name: string; city: string; phone: string; rating: { avg: number; count: number } } }
interface Order { id: string; neededOn: string | null; listingTitle: string; unit: string; status: string; buyerNote: string | null; createdAt: string; quantity: number; unitPrice: number; total: number; reviewed: boolean; counterparty: { name: string; phone: string | null } }
interface Profile { displayName: string; city: string; phone: string; about: string | null }
type Tab = "browse" | "shop" | "buy" | "sell";

const UNITS = ["ekor", "kg", "butir", "liter", "karung", "paket", "unit", "bagian", "layanan"];
const DEFAULT_UNIT: Record<string, string> = { KURBAN: "ekor", AQIQAH: "ekor", SERVICE: "layanan", LIVESTOCK: "ekor", FEED: "karung", MEDICINE: "paket", EQUIPMENT: "unit", PRODUCE: "kg" };
const tomorrow = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const ST: Record<string, string> = { PENDING: "Menunggu penjual", ACCEPTED: "Diterima", SHIPPED: "Dikirim", COMPLETED: "Selesai", REJECTED: "Ditolak", CANCELLED: "Dibatalkan" };
const rp = (n: number) => `Rp ${fmt(Math.round(n))}`;
const wa = (p: string) => `https://wa.me/${p.replace(/[^0-9]/g, "").replace(/^0/, "62")}`;

export default function PasarPage() {
  const me = useMe();
  const toast = useToast();
  const role = me?.organizations.find((o) => o.id === me.activeOrganizationId)?.role;
  const [tab, setTab] = useState<Tab>("browse");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [mine, setMine] = useState<Listing[]>([]);
  const [buy, setBuy] = useState<Order[]>([]);
  const [sell, setSell] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [modal, setModal] = useState<null | "profile" | "listing" | { photos: Listing } | { product: Listing } | { seller: string } | { order: Listing } | { review: Order } | { ship: Order; seller: boolean } | { pay: Order }>(null);
  const [fCat, setFCat] = useState("LIVESTOCK");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const allowed = role === "OWNER" || role === "MANAGER";

  const load = useCallback(() => {
    if (!allowed) return;
    api<{ data: Listing[] }>(`/market/listings?scope=all${cat ? `&category=${cat}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`).then((r) => setListings(r.data)).catch(() => setListings([]));
    api<{ data: Listing[] }>("/market/listings?scope=mine").then((r) => setMine(r.data)).catch(() => undefined);
    api<{ data: Order[] }>("/market/orders?role=buy").then((r) => setBuy(r.data)).catch(() => undefined);
    api<{ data: Order[] }>("/market/orders?role=sell").then((r) => setSell(r.data)).catch(() => undefined);
    api<{ data: Profile | null }>("/market/profile").then((r) => setProfile(r.data)).catch(() => setProfile(null));
  }, [allowed, cat, q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  if (me && !allowed) return <main className="page"><Empty icon="cart" title="Pasar hanya untuk pemilik dan manajer" text="Minta pemilik usaha untuk mengaktifkan akses atau mengubah peranmu." /></main>;

  async function run(fn: () => Promise<unknown>, ok: string, close = true) {
    setBusy(true); setErr(null);
    try { await fn(); if (close) setModal(null); toast({ kind: "ok", title: ok }); load(); }
    catch (x) { const m = x instanceof ApiFailure ? (x.code === "VALIDATION_ERROR" ? "Periksa isian: nomor telepon, harga, dan jumlah harus valid." : x.message) : "Gagal"; if (close) setErr(m); else toast({ kind: "err", title: m }); }
    finally { setBusy(false); }
  }
  const act = (id: string, action: string, ok: string) => run(() => api(`/market/orders/${id}/action`, { body: { action } }), ok, false);
  const num = (f: FormData, k: string) => Number(f.get(k));

  const saveProfile = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => api("/market/profile", { method: "PUT", body: { displayName: f.get("displayName"), city: f.get("city"), phone: f.get("phone"), about: String(f.get("about") ?? "").trim() || undefined } }), "Profil toko disimpan"); };
  const saveListing = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const cat = String(f.get("category"));
    const txt = (k: string) => String(f.get(k) ?? "").trim();
    const nn = (k: string) => (txt(k) ? Number(txt(k)) : undefined);
    const attrs: ListingAttrs | undefined = cat === "KURBAN" || cat === "AQIQAH"
      ? { animal: txt("animal") || undefined, weightKg: nn("weightKg"), ageMonths: nn("ageMonths"), slaughter: f.get("slaughter") === "on", delivery: f.get("delivery") === "on", area: txt("area") || undefined, ...(cat === "KURBAN" && nn("shares") ? { shares: nn("shares") } : {}) }
      : cat === "SERVICE" ? { serviceType: txt("serviceType") || undefined, area: txt("area") || undefined } : undefined;
    const photos = (f.getAll("photos") as File[]).filter((x) => x.size > 0).slice(0, MAX_PHOTOS);
    void run(async () => {
      const r = await api<{ data: { id: string } }>("/market/listings", { body: { title: f.get("title"), category: f.get("category"), description: String(f.get("description") ?? "").trim() || undefined, priceIdr: num(f, "price"), unit: f.get("unit"), stock: num(f, "stock"), status: f.get("publish") ? "PUBLISHED" : "DRAFT", ...(attrs ? { attributes: attrs } : {}) } });
      for (const ph of photos) { try { await uploadListingPhoto(r.data.id, ph); } catch (x) { toast({ kind: "err", title: x instanceof Error ? `Produk tersimpan, tetapi foto gagal: ${x.message}` : "Foto gagal diunggah" }); break; } }
    }, "Produk ditambahkan"); };
  const placeOrder = (e: FormEvent<HTMLFormElement>, l: Listing) => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => api("/market/orders", { body: { listingId: l.id, ...(PREORDER.includes(l.category) ? { neededOn: String(f.get("neededOn")) } : {}), quantity: num(f, "qty"), note: String(f.get("note") ?? "").trim() || undefined, clientId: crypto.randomUUID() } }), "Pesanan terkirim ke penjual").then(() => setTab("buy")); };
  const review = (e: FormEvent<HTMLFormElement>, o: Order) => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => api("/market/reviews", { body: { orderId: o.id, rating: num(f, "rating"), comment: String(f.get("comment") ?? "").trim() || undefined } }), "Terima kasih atas ulasanmu"); };

  const TABS: [Tab, string][] = [["browse", "Semua produk"], ["buy", `Pesanan saya${buy.filter((o) => o.status === "SHIPPED").length ? " •" : ""}`], ["sell", `Pesanan masuk${sell.filter((o) => o.status === "PENDING").length ? ` (${sell.filter((o) => o.status === "PENDING").length})` : ""}`], ["shop", "Toko saya"]];
  const OrderRow = ({ o, seller }: { o: Order; seller: boolean }) => (
    <div className="row" style={{ gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line, #e5e7eb)", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{o.listingTitle} <span className="badge">{ST[o.status]}</span></div>
        <div className="xs muted">{fmt(o.quantity)} {o.unit} × {rp(o.unitPrice)} = <b>{rp(o.total)}</b> · {seller ? "Pembeli" : "Penjual"}: {o.counterparty.name} · {fmtDate(o.createdAt)}{o.neededOn ? ` · Dibutuhkan ${fmtDate(o.neededOn)}` : ""}</div>
        {o.buyerNote && <div className="sm mt-1">“{o.buyerNote}”</div>}
        {o.counterparty.phone && <a className="sm" href={wa(o.counterparty.phone)} target="_blank" rel="noreferrer">Hubungi via WhatsApp ({o.counterparty.phone})</a>}
      </div>
      <div className="row" style={{ gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {seller && o.status === "PENDING" && <><button className="btn btn-primary btn-sm" onClick={() => void act(o.id, "ACCEPT", "Pesanan diterima")}>Terima</button><button className="btn btn-ghost btn-sm" onClick={() => void act(o.id, "REJECT", "Pesanan ditolak")}>Tolak</button></>}
        {seller && o.status === "ACCEPTED" && <><button className="btn btn-primary btn-sm" onClick={() => setModal({ ship: o, seller: true })}>Kirim</button><button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm("Batalkan pesanan ini? Stok dikembalikan.")) void act(o.id, "CANCEL", "Pesanan dibatalkan"); }}>Batalkan</button></>}
        {!seller && o.status === "PENDING" && <button className="btn btn-ghost btn-sm" onClick={() => void act(o.id, "CANCEL", "Pesanan dibatalkan")}>Batalkan</button>}
        {o.status === "SHIPPED" && <button className="btn btn-secondary btn-sm" onClick={() => setModal({ ship: o, seller })}>Pelacakan</button>}
        {["ACCEPTED", "SHIPPED", "COMPLETED"].includes(o.status) && <button className="btn btn-ghost btn-sm" onClick={() => setModal({ pay: o })}>Pembayaran</button>}
        {!seller && o.status === "SHIPPED" && <button className="btn btn-primary btn-sm" onClick={() => void act(o.id, "COMPLETE", "Pesanan selesai")}>Barang diterima</button>}
        {!seller && o.status === "COMPLETED" && !o.reviewed && <button className="btn btn-secondary btn-sm" onClick={() => { setErr(null); setModal({ review: o }); }}>Beri ulasan</button>}
      </div>
    </div>);

  return (
    <main className="page">
      <div className="page-h"><div><h1>Pasar</h1><p>Beli dan jual ternak, pakan, obat, dan peralatan antar peternak. Pembayaran dilakukan langsung antara pembeli dan penjual.</p></div></div>
      <div className="seg" role="tablist" style={{ flexWrap: "wrap" }}>{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} type="button">{l}</button>)}</div>

      {tab === "browse" && (<div className="mt-3">
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Cari produk…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari produk" />
          <select className="input" style={{ maxWidth: 200 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori"><option value="">Semua kategori</option>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        {listings === null ? <Skeleton h={160} /> : listings.length === 0 ? <Empty icon="cart" title="Belum ada produk" text="Belum ada penjual yang memasang produk di kategori ini." /> : (
          <div className="grid g3">{listings.map((l) => (
            <div className="card card-pad" key={l.id}>
              <button type="button" onClick={() => setModal({ product: l })} aria-label={`Lihat ${l.title}`} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "none", cursor: "pointer" }}><Photo id={l.images[0]} alt={l.title} /></button>
              <div className="row mt-1" style={{ gap: 6 }}><span className="badge">{CAT[l.category]}</span>{l.isMine && <span className="badge">Produkmu</span>}</div>
              <h3 className="mt-1" style={{ cursor: "pointer" }} onClick={() => setModal({ product: l })}>{l.title}</h3>
              <AttrChips attrs={l.attributes} />
              <div style={{ fontSize: 20, fontWeight: 700 }}>{rp(l.priceIdr)} <span className="muted sm">/ {l.unit}</span></div>
              <div className="xs muted">Stok {fmt(l.stock)} {l.unit} · <button type="button" onClick={() => setModal({ seller: l.sellerOrgId })} style={{ background: "none", border: 0, padding: 0, color: "inherit", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>{l.seller.name}</button>{l.seller.city ? `, ${l.seller.city}` : ""}{l.seller.rating.count ? ` · ★ ${l.seller.rating.avg.toFixed(1)} (${l.seller.rating.count})` : ""}</div>
              {l.description && <p className="sm mt-1" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{l.description}</p>}
              <div className="row mt-2" style={{ gap: 6 }}><button className="btn btn-secondary btn-sm" onClick={() => setModal({ product: l })}>Detail</button>{!l.isMine && <button className="btn btn-primary btn-sm" onClick={() => { setErr(null); setModal({ order: l }); }}>Pesan</button>}</div>
            </div>))}</div>)}
      </div>)}

      {tab === "buy" && <div className="mt-3">{buy.length === 0 ? <Empty icon="cart" title="Belum ada pesanan" text="Pesanan yang kamu buat akan muncul di sini." /> : <div className="card">{buy.map((o) => <OrderRow key={o.id} o={o} seller={false} />)}</div>}</div>}
      {tab === "sell" && <div className="mt-3">{sell.length === 0 ? <Empty icon="cart" title="Belum ada pesanan masuk" text="Pesanan dari pembeli akan muncul di sini." /> : <div className="card">{sell.map((o) => <OrderRow key={o.id} o={o} seller />)}</div>}</div>}

      {tab === "shop" && (<div className="mt-3">
        <div className="card card-pad">
          {profile ? (<div className="row" style={{ justifyContent: "space-between", gap: 12 }}><div><h3>{profile.displayName}</h3><div className="xs muted">{profile.city} · {profile.phone}</div>{profile.about && <p className="sm mt-1">{profile.about}</p>}</div><button className="btn btn-secondary btn-sm" onClick={() => { setErr(null); setModal("profile"); }}>Ubah</button></div>)
            : <div className="row" style={{ justifyContent: "space-between", gap: 12 }}><div><h3>Buka tokomu</h3><p className="muted sm">Isi nama toko, kota, dan nomor WhatsApp agar pembeli bisa menghubungi.</p></div><button className="btn btn-primary" onClick={() => { setErr(null); setModal("profile"); }}>Buat profil toko</button></div>}
        </div>
        {profile && (<><div className="page-h mt-3"><div><h2 style={{ fontSize: 18 }}>Produk saya</h2></div><button className="btn btn-primary" onClick={() => { setErr(null); setModal("listing"); }}>Tambah produk</button></div>
          {mine.length === 0 ? <Empty icon="cart" title="Belum ada produk" /> : <div className="card table-wrap"><table className="table"><thead><tr><th>Produk</th><th className="num">Harga</th><th className="num">Stok</th><th>Status</th><th /></tr></thead><tbody>
            {mine.map((l) => (<tr key={l.id}><td><div className="row" style={{ gap: 10, alignItems: "center" }}><div style={{ width: 52, flex: "none" }}><Photo id={l.images[0]} alt="" ratio="1 / 1" radius={8} /></div><div>{l.title}<div className="xs muted">{CAT[l.category]} · {l.images.length} foto</div></div></div></td><td className="num">{rp(l.priceIdr)} / {l.unit}</td><td className="num">{fmt(l.stock)}</td><td>{l.status === "PUBLISHED" ? "Tayang" : l.status === "DRAFT" ? "Draf" : "Diarsipkan"}</td>
              <td className="tr"><button className="btn btn-ghost btn-sm" onClick={() => setModal({ photos: l })}>Foto</button><button className="btn btn-ghost btn-sm" onClick={() => void run(() => api(`/market/listings/${l.id}`, { method: "PATCH", body: { status: l.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED" } }), l.status === "PUBLISHED" ? "Produk diturunkan" : "Produk ditayangkan", false)}>{l.status === "PUBLISHED" ? "Turunkan" : "Tayangkan"}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { const v = window.prompt("Stok baru:", String(l.stock)); if (v !== null && v.trim() !== "" && Number(v) >= 0) void run(() => api(`/market/listings/${l.id}`, { method: "PATCH", body: { stock: Number(v) } }), "Stok diperbarui", false); }}>Ubah stok</button></td></tr>))}</tbody></table></div>}</>)}
      </div>)}

      {modal === "profile" && (<Modal title="Profil toko" onClose={() => setModal(null)}><form onSubmit={saveProfile} className="stack">
        <div className="field"><label htmlFor="displayName">Nama toko</label><input id="displayName" name="displayName" className="input" required minLength={2} maxLength={100} defaultValue={profile?.displayName ?? ""} /></div>
        <div className="grid g2"><div className="field"><label htmlFor="city">Kota / kabupaten</label><input id="city" name="city" className="input" required defaultValue={profile?.city ?? ""} /></div><div className="field"><label htmlFor="phone">WhatsApp</label><input id="phone" name="phone" className="input" required placeholder="0812xxxxxxx" defaultValue={profile?.phone ?? ""} /></div></div>
        <div className="field"><label htmlFor="about">Tentang toko</label><input id="about" name="about" className="input" maxLength={500} defaultValue={profile?.about ?? ""} placeholder="opsional" /></div>
        {err && <div className="alert err">{err}</div>}<button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button></form></Modal>)}

      {modal === "listing" && (<Modal title="Tambah produk" onClose={() => setModal(null)}><form onSubmit={saveListing} className="stack">
        <div className="field"><label htmlFor="title">Nama produk</label><input id="title" name="title" className="input" required minLength={3} maxLength={120} placeholder="contoh: Anak kambing PE umur 4 bulan" /></div>
        <div className="grid g2"><div className="field"><label htmlFor="category">Kategori</label><select id="category" name="category" className="input" value={fCat} onChange={(e) => setFCat(e.target.value)}>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div><div className="field"><label htmlFor="unit">Satuan</label><select id="unit" name="unit" key={fCat} className="input" defaultValue={DEFAULT_UNIT[fCat] ?? "ekor"}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div></div>
        {(fCat === "KURBAN" || fCat === "AQIQAH") && (<>
          <div className="grid g2"><div className="field"><label htmlFor="animal">Jenis hewan</label><select id="animal" name="animal" className="input" defaultValue="KAMBING">{Object.entries(ANIMALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div><div className="field"><label htmlFor="weightKg">Perkiraan bobot (kg)</label><input id="weightKg" name="weightKg" type="number" min="1" step="0.1" className="input" /></div></div>
          <div className="grid g2"><div className="field"><label htmlFor="ageMonths">Umur (bulan)</label><input id="ageMonths" name="ageMonths" type="number" min="1" className="input" /></div>{fCat === "KURBAN" && <div className="field"><label htmlFor="shares">Patungan: bagian per ekor (1-7)</label><input id="shares" name="shares" type="number" min="1" max="7" className="input" placeholder="kosongkan bila utuh" /></div>}</div>
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}><label className="row" style={{ gap: 6 }}><input type="checkbox" name="slaughter" /> Termasuk penyembelihan</label><label className="row" style={{ gap: 6 }}><input type="checkbox" name="delivery" /> Bisa diantar</label></div>
          <div className="field"><label htmlFor="area">Area layanan/antar</label><input id="area" name="area" className="input" maxLength={120} placeholder="contoh: Bandung dan sekitarnya" /></div>
          <p className="xs muted">Untuk patungan, buat satuan "bagian", isi stok dengan jumlah bagian tersisa, dan harga per bagian.</p></>)}
        {fCat === "SERVICE" && (<div className="grid g2"><div className="field"><label htmlFor="serviceType">Jenis layanan</label><select id="serviceType" name="serviceType" className="input" defaultValue="PENYEMBELIHAN">{Object.entries(SERVICE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div><div className="field"><label htmlFor="area">Area layanan</label><input id="area" name="area" className="input" maxLength={120} /></div></div>)}
        <div className="grid g2"><div className="field"><label htmlFor="price">Harga per satuan (Rp)</label><input id="price" name="price" type="number" min="0" inputMode="numeric" className="input" required /></div><div className="field"><label htmlFor="stock">Stok</label><input id="stock" name="stock" type="number" min="0" step="0.001" inputMode="decimal" className="input" required /></div></div>
        <div className="field"><label htmlFor="description">Deskripsi</label><input id="description" name="description" className="input" maxLength={1000} placeholder="opsional" /></div>
        <div className="field"><label htmlFor="photos">Foto produk (maks. {MAX_PHOTOS}, opsional)</label><input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="input" /></div>
        <label className="row" style={{ gap: 8 }}><input type="checkbox" name="publish" defaultChecked /> Tayangkan sekarang</label>
        {err && <div className="alert err">{err}</div>}<button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Menyimpan…" : "Simpan produk"}</button></form></Modal>)}

      {modal && typeof modal === "object" && "order" in modal && (<Modal title={`Pesan: ${modal.order.title}`} onClose={() => setModal(null)}><form onSubmit={(e) => placeOrder(e, (modal as { order: Listing }).order)} className="stack">
        <p className="sm muted">{rp(modal.order.priceIdr)} / {modal.order.unit} · stok {fmt(modal.order.stock)}. Pembayaran diatur langsung dengan penjual setelah pesanan diterima.</p>
        <div className="field"><label htmlFor="qty">Jumlah ({modal.order.unit})</label><input id="qty" name="qty" type="number" min="0.001" step="0.001" max={modal.order.stock} className="input" required defaultValue="1" /></div>
        {PREORDER.includes(modal.order.category) && <div className="field"><label htmlFor="neededOn">Tanggal dibutuhkan</label><input id="neededOn" name="neededOn" type="date" min={tomorrow()} required className="input" /></div>}
        <div className="field"><label htmlFor="note">Catatan untuk penjual</label><input id="note" name="note" className="input" maxLength={500} placeholder="opsional" /></div>
        {err && <div className="alert err">{err}</div>}<button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Mengirim…" : "Kirim pesanan"}</button></form></Modal>)}

      {modal && typeof modal === "object" && "photos" in modal && <PhotoManager listing={modal.photos} onClose={() => setModal(null)} onChanged={load} />}
      {modal && typeof modal === "object" && "seller" in modal && <SellerModal orgId={modal.seller} onClose={() => setModal(null)} onProduct={(id) => { const l = listings?.find((x) => x.id === id); if (l) setModal({ product: l }); }} />}
      {modal && typeof modal === "object" && "product" in modal && <ProductModal p={modal.product as ProductDetail} onClose={() => setModal(null)} onOrder={() => { setErr(null); setModal({ order: (modal as { product: Listing }).product }); }} onSeller={() => setModal({ seller: (modal as { product: Listing }).product.sellerOrgId })} />}
      {modal && typeof modal === "object" && "pay" in modal && <PaymentModal orderId={modal.pay.id} title={modal.pay.listingTitle} onClose={() => setModal(null)} onChanged={load} />}
      {modal && typeof modal === "object" && "ship" in modal && <ShipmentModal orderId={modal.ship.id} title={modal.ship.listingTitle} status={modal.ship.status} seller={modal.seller} onClose={() => setModal(null)} onChanged={load} />}
      {modal && typeof modal === "object" && "review" in modal && (<Modal title="Beri ulasan" onClose={() => setModal(null)}><form onSubmit={(e) => review(e, (modal as { review: Order }).review)} className="stack">
        <div className="field"><label htmlFor="rating">Nilai</label><select id="rating" name="rating" className="input" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}</select></div>
        <div className="field"><label htmlFor="comment">Komentar</label><input id="comment" name="comment" className="input" maxLength={500} placeholder="opsional" /></div>
        {err && <div className="alert err">{err}</div>}<button className="btn btn-primary btn-block" disabled={busy}>Kirim ulasan</button></form></Modal>)}
    </main>
  );
}
