import { can } from "@sl/permissions";
import { z } from "zod";
import { detectIntent, searchKnowledge, SUGGESTIONS, type Intent } from "@/server/assistant";
import { addMonths, autoCosts, monthRange, ym } from "@/server/finance";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

const body = z.object({ question: z.string().trim().min(2).max(300) });
const DAY = 864e5;
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
interface Answer { kind: "data" | "knowledge" | "none"; answer: string; link?: { href: string; label: string } | undefined; source: string }

// POST /api/v1/assistant { question } -> jawaban dari data organisasi (sesuai izin dan batas farm) atau panduan umum
export const POST = tenantRoute({ permission: "dashboard.read" }, async (c) => {
  const { question } = body.parse(await c.req.json());
  const intent = detectIntent(question);
  const restricted = c.allowedFarmIds !== null;
  const farmScope = restricted ? { farmId: { in: c.allowedFarmIds ?? [] } } : {};
  const batches = intent && ["POPULASI", "KEMATIAN", "PAKAN"].includes(intent) ? await c.tx.livestockBatch.findMany({ where: { status: "ACTIVE", ...farmScope }, select: { id: true, code: true, initialCount: true } }) : [];
  const ids = batches.map((b) => b.id);

  async function dataAnswer(i: Intent): Promise<Answer | null> {
    if (i === "POPULASI") {
      if (batches.length === 0) return { kind: "data", answer: "Belum ada batch aktif.", link: { href: "/app/ternak", label: "Tambah batch" }, source: "Data ternak" };
      const pops = await c.tx.$queryRaw<{ batch_id: string; current_count: bigint }[]>`SELECT batch_id, current_count FROM batch_population WHERE batch_id = ANY(${ids}::uuid[])`;
      const by = new Map(pops.map((p) => [p.batch_id, Number(p.current_count)]));
      const rows = batches.map((b) => ({ code: b.code, n: by.get(b.id) ?? b.initialCount })).sort((a, z) => z.n - a.n);
      const total = rows.reduce((s, r) => s + r.n, 0);
      return { kind: "data", answer: `Total ${total.toLocaleString("id-ID")} ekor di ${rows.length} batch aktif: ${rows.slice(0, 6).map((r) => `${r.code} (${r.n.toLocaleString("id-ID")})`).join(", ")}${rows.length > 6 ? ", dan lainnya" : ""}.`, link: { href: "/app/ternak", label: "Lihat ternak" }, source: "Data ternak" };
    }
    if (i === "KEMATIAN") {
      const since = new Date(Date.now() - 7 * DAY);
      const rows = await c.tx.mortalityRecord.findMany({ where: { voidedAt: null, occurredOn: { gte: since }, ...(restricted ? { batchId: { in: ids } } : {}) }, select: { count: true, batchId: true } });
      const total = rows.reduce((s, r) => s + r.count, 0);
      return { kind: "data", answer: total === 0 ? "Tidak ada kematian tercatat dalam 7 hari terakhir." : `${total.toLocaleString("id-ID")} ekor mati tercatat dalam 7 hari terakhir. Bila angkanya naik mendadak, cek menu AI untuk peringatan dini dan hubungi dokter hewan.`, link: { href: "/app/ai", label: "Buka AI (peringatan dini)" }, source: "Catatan kematian" };
    }
    if (i === "TUGAS") {
      const today = new Date(new Date().toISOString().slice(0, 10));
      const tasks = await c.tx.task.findMany({ where: { status: "OPEN", dueOn: { lte: new Date(today.getTime() + DAY) } }, orderBy: { dueOn: "asc" }, take: 8, select: { title: true, dueOn: true } });
      return { kind: "data", answer: tasks.length === 0 ? "Tidak ada tugas yang jatuh tempo hari ini atau terlambat." : `${tasks.length} tugas jatuh tempo atau terlambat: ${tasks.map((t) => `${t.title} (${t.dueOn.toISOString().slice(5, 10)})`).join("; ")}.`, link: { href: "/app/tugas", label: "Buka Tugas" }, source: "Tugas" };
    }
    if (i === "ALARM") {
      if (!can(c.role, "iot.read")) return null;
      const open = await c.tx.alertEvent.findMany({ where: { resolvedAt: null }, orderBy: { triggeredAt: "desc" }, take: 6 });
      return { kind: "data", answer: open.length === 0 ? "Tidak ada alarm sensor yang aktif." : `${open.length} alarm aktif: ${open.map((a) => `${a.ruleName} (nilai ${a.value})`).join("; ")}.`, link: { href: "/app/iot", label: "Buka IoT" }, source: "Alarm IoT" };
    }
    if (i === "PAKAN") {
      const since = new Date(Date.now() - 30 * DAY);
      const rows = await c.tx.feedRecord.findMany({ where: { voidedAt: null, givenOn: { gte: since }, ...(restricted ? { batchId: { in: ids } } : {}) }, select: { quantityKg: true } });
      const kg = rows.reduce((s, r) => s + Number(r.quantityKg), 0);
      return { kind: "data", answer: `Pakan 30 hari terakhir: ${Math.round(kg).toLocaleString("id-ID")} kg dari ${rows.length} catatan.`, link: { href: "/app/pakan", label: "Buka Pakan" }, source: "Catatan pakan" };
    }
    if (i === "KEUANGAN") {
      if (!can(c.role, "finance.read") || restricted) return { kind: "data", answer: "Data keuangan hanya bisa dilihat pemilik atau manajer dengan akses ke semua farm.", source: "Izin akses" };
      const { from, to } = monthRange(ym(new Date()));
      const [entries, costs] = await Promise.all([
        c.tx.financeEntry.findMany({ where: { voidedAt: null, occurredOn: { gte: from, lt: to } }, select: { kind: true, amount: true } }),
        autoCosts(c.tx, from, addMonths(from, 1)),
      ]);
      const income = entries.filter((e) => e.kind === "INCOME").reduce((s, e) => s + Number(e.amount), 0);
      const expense = entries.filter((e) => e.kind === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0) + costs.reduce((s, k) => s + k.amount, 0);
      return { kind: "data", answer: `Bulan ini: pemasukan ${rp(income)}, pengeluaran ${rp(expense)}, ${income - expense >= 0 ? "laba" : "rugi"} ${rp(Math.abs(income - expense))}.`, link: { href: "/app/keuangan", label: "Buka Keuangan" }, source: "Keuangan" };
    }
    if (i === "PREDIKSI") return { kind: "data", answer: "Perkiraan bobot, waktu panen, FCR, dan peringatan dini dihitung per batch di menu AI dari data timbangan dan pakanmu.", link: { href: "/app/ai", label: "Buka AI (prediksi)" }, source: "Menu AI" };
    return null;
  }

  let result: Answer | null = intent ? await dataAnswer(intent) : null;
  if (!result) {
    const hit = searchKnowledge(question);
    if (hit) result = { kind: "knowledge", answer: hit.entry.answer, link: hit.entry.link, source: `Panduan umum: ${hit.entry.title}` };
  }
  if (!result) result = { kind: "none", answer: "Maaf, saya belum bisa menjawab itu. Saya bisa membaca data usahamu (populasi, kematian, tugas, alarm, pakan, keuangan) dan menjelaskan hal dasar seperti FCR, brooding, kualitas air, dan biosekuriti. Untuk hal medis, tanyakan ke dokter hewan.", link: { href: "/app/dokter", label: "Konsultasi dokter hewan" }, source: "-" };
  return Response.json({ data: { ...result, suggestions: result.kind === "none" ? SUGGESTIONS.slice(0, 4) : [] } });
});

// GET /api/v1/assistant -> contoh pertanyaan
export const GET = tenantRoute({ permission: "dashboard.read" }, async () => Response.json({ data: { suggestions: SUGGESTIONS } }));
