"use client";
import { useCallback, useEffect, useState } from "react";
import { Modal, Skeleton, useToast } from "@/components/ui";
import { api } from "@/lib/api";

interface Payment { method: string; reference: string | null; amount: number; status: string; disputeReason: string | null }
interface Data { payment: Payment | null; orderTotal: number; shippingFee: number; role: "buyer" | "seller" }

const METHOD: Record<string, string> = { TRANSFER: "Transfer bank", QRIS: "QRIS", COD: "Bayar di tempat (COD)" };
const STATUS: Record<string, string> = { AWAITING: "Menunggu pembayaran", PROOF_SUBMITTED: "Menunggu konfirmasi penjual", HELD: "Dana dikonfirmasi diterima", RELEASED: "Selesai", DISPUTED: "Disengketakan", REFUNDED: "Dikembalikan" };
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export function PaymentModal({ orderId, title, onClose, onChanged }: { orderId: string; title: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ method: "TRANSFER", reference: "" });
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    api<{ data: Data }>(`/market/orders/${orderId}/payment`).then((r) => { setD(r.data); if (r.data.payment) setF({ method: r.data.payment.method, reference: r.data.payment.reference ?? "" }); }).catch((e: Error) => toast({ kind: "err", title: e.message }));
  }, [orderId, toast]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast({ kind: "ok", title: ok }); load(); onChanged(); } catch (e) { toast({ kind: "err", title: (e as Error).message }); } finally { setBusy(false); }
  }
  const submit = () => run(() => api(`/market/orders/${orderId}/payment`, { method: "PUT", body: { method: f.method, reference: f.reference || undefined } }), "Pembayaran dicatat");
  const act = (action: string, ok: string, r?: string) => run(() => api(`/market/orders/${orderId}/payment/action`, { body: { action, reason: r } }), ok);

  const p = d?.payment;
  const editable = d?.role === "buyer" && (!p || p.status === "AWAITING" || p.status === "PROOF_SUBMITTED");
  return (
    <Modal title={`Pembayaran: ${title}`} onClose={onClose}>
      {!d ? <Skeleton h={120} /> : (<div className="stack">
        <div className="alert info sm">Mode manual: pembayaran dilakukan langsung antar pihak dan dicatat di sini. Tidak ada pihak ketiga yang menahan uang, jadi pastikan menghubungi penjual lewat WhatsApp sebelum transfer.</div>
        <div className="sm">Barang {rp(d.orderTotal)}{d.shippingFee > 0 ? ` + ongkir ${rp(d.shippingFee)}` : ""} = <b>{rp(d.orderTotal + d.shippingFee)}</b></div>
        {p && <div className="sm"><span className="badge">{STATUS[p.status]}</span> {METHOD[p.method]}{p.reference ? ` · ref ${p.reference}` : ""}{p.disputeReason ? <div className="muted">Alasan sengketa: {p.disputeReason}</div> : null}</div>}
        {editable && (<>
          <div className="field"><label htmlFor="pm">Cara bayar</label><select id="pm" className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          {f.method !== "COD" && <div className="field"><label htmlFor="pr">No. referensi / catatan transfer</label><input id="pr" className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>}
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>{f.method === "COD" ? "Pilih bayar di tempat" : "Saya sudah membayar"}</button>
        </>)}
        {d.role === "seller" && p?.status === "PROOF_SUBMITTED" && <button className="btn btn-primary" disabled={busy} onClick={() => void act("CONFIRM_RECEIVED", "Pembayaran dikonfirmasi")}>Dana sudah saya terima</button>}
        {d.role === "seller" && p?.status === "DISPUTED" && <button className="btn btn-secondary" disabled={busy} onClick={() => { if (window.confirm("Kembalikan dana ke pembeli dan batalkan pesanan? Stok dikembalikan.")) void act("REFUND", "Dana dikembalikan, pesanan dibatalkan"); }}>Setujui pengembalian dana</button>}
        {d.role === "buyer" && p && (p.status === "PROOF_SUBMITTED" || p.status === "HELD") && (<>
          <div className="field"><label htmlFor="dr">Ada masalah dengan pesanan?</label><input id="dr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jelaskan masalahnya" /></div>
          <button className="btn btn-ghost" disabled={busy || reason.trim().length < 5} onClick={() => void act("DISPUTE", "Sengketa dicatat", reason.trim())}>Ajukan sengketa</button>
        </>)}
      </div>)}
    </Modal>
  );
}
