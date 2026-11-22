// Paket langganan Nusa Ternak. Harga dan batas di bawah adalah nilai awal yang bisa diubah di sini.
// Fungsi murni (tanpa database) supaya mudah diuji.
export type PlanId = "FREE" | "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";
export type Resource = "farms" | "members" | "devices";
export interface PlanDef { id: PlanId; name: string; priceMonthly: number; limits: Record<Resource, number | null>; highlights: string[] }

export const PLANS: Record<PlanId, PlanDef> = {
  FREE: { id: "FREE", name: "Gratis", priceMonthly: 0, limits: { farms: 2, members: 5, devices: 3 }, highlights: ["Catat ternak, pakan, produksi", "Marketplace dasar"] },
  STARTER: { id: "STARTER", name: "Starter", priceMonthly: 99_000, limits: { farms: 5, members: 15, devices: 15 }, highlights: ["Semua fitur Gratis", "Laporan CSV", "IoT hingga 15 perangkat"] },
  PRO: { id: "PRO", name: "Pro", priceMonthly: 299_000, limits: { farms: 20, members: 50, devices: 100 }, highlights: ["Semua fitur Starter", "Keuangan dan invoice", "Prediksi dan peringatan dini"] },
  BUSINESS: { id: "BUSINESS", name: "Bisnis", priceMonthly: 799_000, limits: { farms: 100, members: 250, devices: 500 }, highlights: ["Semua fitur Pro", "Batas besar", "Prioritas bantuan"] },
  ENTERPRISE: { id: "ENTERPRISE", name: "Enterprise", priceMonthly: 0, limits: { farms: null, members: null, devices: null }, highlights: ["Tanpa batas", "Hubungi kami"] },
};
export const PAID_PLANS: PlanId[] = ["STARTER", "PRO", "BUSINESS"];

/** Paket yang berlaku: paket berbayar yang sudah lewat masa aktif diperlakukan sebagai Gratis (data tidak dihapus). */
export function effectivePlan(plan: PlanId, expiresAt: Date | null, now = new Date()): PlanId {
  if (plan === "FREE" || plan === "ENTERPRISE") return plan;
  return expiresAt && expiresAt.getTime() > now.getTime() ? plan : "FREE";
}
export function limitFor(plan: PlanId, resource: Resource): number | null { return PLANS[plan].limits[resource]; }
/** True bila menambah satu lagi masih di dalam batas. */
export function canAdd(plan: PlanId, resource: Resource, current: number): boolean {
  const lim = limitFor(plan, resource);
  return lim === null || current < lim;
}
export function planPrice(plan: PlanId, months: number): number { return PLANS[plan].priceMonthly * months; }
/** Tanggal berakhir baru: dihitung dari masa aktif yang masih berjalan (perpanjangan tidak menghanguskan sisa). */
export function extendExpiry(current: Date | null, months: number, now = new Date()): Date {
  const base = current && current.getTime() > now.getTime() ? new Date(current) : new Date(now);
  base.setUTCMonth(base.getUTCMonth() + months);
  return base;
}
