"use client";
import { useCallback, useEffect, useState } from "react";
import { Modal, Skeleton, fmtDate, useToast } from "@/components/ui";
import { api } from "@/lib/api";

interface Ev { id: string; status: string; location: string | null; note: string | null; createdAt: string }
interface Shipment { method: string; courier: string | null; trackingNumber: string | null; fee: number; etaOn: string | null; note: string | null; events: Ev[]; canEdit: boolean }

const METHOD: Record<string, string> = { KURIR: "Kurir / ekspedisi", ANTAR_SENDIRI: "Diantar penjual", AMBIL_SENDIRI: "Diambil pembeli" };
const STATUS: Record<string, string> = { DIKEMAS: "Dikemas", DISERAHKAN_KURIR: "Diserahkan ke kurir", DALAM_PERJALANAN: "Dalam perjalanan", TIBA_DI_TUJUAN: "Tiba di tujuan", GAGAL_KIRIM: "Gagal kirim" };
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export function ShipmentModal({ orderId, title, status, seller, onClose, onChanged }: { orderId: string; title: string; status: string; seller: boolean; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [sh, setSh] = useState<Shipment | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ method: "KURIR", courier: "", trackingNumber: "", fee: "", etaOn: "", note: "" });
  const [ev, setEv] = useState({ status: "DALAM_PERJALANAN", location: "", note: "" });

  const load = useCallback(() => {
    api<{ data: Shipment | null }>(`/market/orders/${orderId}/shipment`).then((r) => {
      setSh(r.data);
      if (r.data) setF({ method: r.data.method, courier: r.data.courier ?? "", trackingNumber: r.data.trackingNumber ?? "", fee: r.data.fee ? String(r.data.fee) : "", etaOn: r.data.etaOn ?? "", note: r.data.note ?? "" });
    }).catch((e: Error) => { setSh(null); toast({ kind: "err", title: e.message }); });
  }, [orderId, toast]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast({ kind: "ok", title: ok }); load(); onChanged(); } catch (e) { toast({ kind: "err", title: (e as Error).message }); } finally { setBusy(false); }
  }
  const saveShipment = () => run(() => api(`/market/orders/${orderId}/shipment`, { method: "PUT", body: { method: f.method, courier: f.courier || undefined, trackingNumber: f.trackingNumber || undefined, fee: Number(f.fee) || 0, etaOn: f.etaOn || undefined, note: f.note || undefined } }), status === "ACCEPTED" ? "Pesanan ditandai dikirim" : "Data pengiriman disimpan");
  const addEvent = () => run(() => api(`/market/orders/${orderId}/shipment/events`, { body: { status: ev.status, location: ev.location || undefined, note: ev.note || undefined } }), "Pelacakan ditambahkan");

  const canEditForm = seller && (status === "ACCEPTED" || status === "SHIPPED");
  return (
    <Modal title={`Pengiriman: ${title}`} onClose={onClose}>
      {sh === undefined ? <Skeleton h={120} /> : (<div className="stack">
        {sh && (
          <div className="sm">
            <div><b>{METHOD[sh.method]}</b>{sh.courier ? ` · ${sh.courier}` : ""}{sh.trackingNumber ? ` · resi ${sh.trackingNumber}` : ""}</div>
            <div className="muted">{sh.fee > 0 ? `Ongkir ${rp(sh.fee)}` : "Tanpa ongkir"}{sh.etaOn ? ` · estimasi tiba ${fmtDate(sh.etaOn)}` : ""}</div>
            {sh.note && <div className="muted">{sh.note}</div>}
          </div>)}
        {sh && sh.events.length > 0 && (
          <div>
            <div className="xs muted" style={{ marginBottom: 4 }}>Riwayat pelacakan</div>
            {[...sh.events].reverse().map((e) => (
              <div key={e.id} className="list-item" style={{ alignItems: "flex-start" }}>
                <div className="grow"><div style={{ fontWeight: 600 }}>{STATUS[e.status] ?? e.status}{e.location ? ` · ${e.location}` : ""}</div><div className="xs muted">{new Date(e.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}{e.note ? ` · ${e.note}` : ""}</div></div>
              </div>))}
          </div>)}
        {!sh && !canEditForm && <p className="sm muted">Penjual belum mengisi data pengiriman.</p>}
        {canEditForm && (<>
          <h4 style={{ margin: "8px 0 0" }}>{sh ? "Ubah data pengiriman" : "Isi data pengiriman"}</h4>
          <div className="field"><label htmlFor="sm">Cara kirim</label><select id="sm" className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          {f.method === "KURIR" && <div className="grid g2">
            <div className="field"><label htmlFor="sc">Kurir</label><input id="sc" className="input" value={f.courier} onChange={(e) => setF({ ...f, courier: e.target.value })} placeholder="JNE, J&T, kargo..." /></div>
            <div className="field"><label htmlFor="sr">No. resi</label><input id="sr" className="input" value={f.trackingNumber} onChange={(e) => setF({ ...f, trackingNumber: e.target.value })} /></div>
          </div>}
          <div className="grid g2">
            <div className="field"><label htmlFor="sf">Ongkir (Rp)</label><input id="sf" className="input" type="number" min="0" inputMode="numeric" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></div>
            <div className="field"><label htmlFor="se">Estimasi tiba</label><input id="se" className="input" type="date" value={f.etaOn} onChange={(e) => setF({ ...f, etaOn: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="sn">Catatan</label><input id="sn" className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={busy || (f.method === "KURIR" && !f.courier.trim())} onClick={() => void saveShipment()}>{status === "ACCEPTED" ? "Simpan dan tandai dikirim" : "Simpan"}</button>
        </>)}
        {seller && sh && status === "SHIPPED" && (<>
          <h4 style={{ margin: "8px 0 0" }}>Tambah titik pelacakan</h4>
          <div className="grid g2">
            <div className="field"><label htmlFor="es">Status</label><select id="es" className="input" value={ev.status} onChange={(e) => setEv({ ...ev, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field"><label htmlFor="el">Lokasi</label><input id="el" className="input" value={ev.location} onChange={(e) => setEv({ ...ev, location: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="en">Catatan</label><input id="en" className="input" value={ev.note} onChange={(e) => setEv({ ...ev, note: e.target.value })} /></div>
          <button className="btn btn-secondary" disabled={busy} onClick={() => void addEvent()}>Tambah</button>
          <p className="xs muted">Riwayat pelacakan tidak bisa diubah setelah ditambahkan.</p>
        </>)}
      </div>)}
    </Modal>
  );
}
