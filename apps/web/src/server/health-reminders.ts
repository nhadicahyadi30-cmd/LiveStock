import type { Prisma } from "@sl/database";

type Tx = Prisma.TransactionClient;

const DAY = 86_400_000;
/** Tanggal hari ini menurut WIB (UTC+7), sebagai UTC tengah malam, cocok dengan kolom @db.Date. */
export function todayWib(now = new Date()): Date {
  const w = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
}

/** Pengingat dikirim saat jadwal tinggal 3 hari, dan sekali lagi bila sudah lewat. */
export function reminderPhase(eventOn: Date, today: Date): "soon" | "overdue" | null {
  const diff = Math.round((eventOn.getTime() - today.getTime()) / DAY);
  if (diff < 0) return "overdue";
  if (diff <= 3) return "soon";
  return null;
}

/**
 * Membuat notifikasi (sekali per catatan per fase) untuk jadwal kesehatan berstatus PLANNED
 * milik pengguna ini. Dipanggil malas saat daftar notifikasi dibuka, jadi tanpa cron.
 * Hanya VACCINATION dan TREATMENT berjadwal; hanya farm yang boleh diakses pengguna.
 */
export async function ensureHealthReminders(
  tx: Tx,
  p: { organizationId: string; userId: string; allowedFarmIds: string[] | null; now?: Date },
): Promise<number> {
  const today = todayWib(p.now);
  const horizon = new Date(today.getTime() + 3 * DAY);
  const rows = await tx.healthRecord.findMany({
    where: {
      status: "PLANNED",
      voidedAt: null,
      eventOn: { lte: horizon },
      ...(p.allowedFarmIds ? { batch: { farmId: { in: p.allowedFarmIds } } } : {}),
    },
    select: { id: true, title: true, kind: true, eventOn: true, batch: { select: { code: true } } },
    orderBy: { eventOn: "asc" },
    take: 30,
  });
  if (rows.length === 0) return 0;

  const wanted = rows.flatMap((r) => {
    const phase = reminderPhase(r.eventOn, today);
    if (!phase) return [];
    const href = `/app/kesehatan#${r.id}:${phase}`;
    const when = r.eventOn.toISOString().slice(0, 10);
    const label = r.kind === "VACCINATION" ? "Vaksinasi" : "Pengobatan";
    return [{
      href,
      title: phase === "overdue" ? `${label} terlambat: ${r.title}` : `${label} segera: ${r.title}`,
      body: `Batch ${r.batch.code} - jadwal ${when}`,
    }];
  });
  if (wanted.length === 0) return 0;

  const existing = await tx.notification.findMany({
    where: { userId: p.userId, kind: "health.reminder", href: { in: wanted.map((w) => w.href) } },
    select: { href: true },
  });
  const have = new Set(existing.map((e) => e.href));
  const fresh = wanted.filter((w) => !have.has(w.href));
  if (fresh.length === 0) return 0;
  await tx.notification.createMany({
    data: fresh.map((w) => ({ organizationId: p.organizationId, userId: p.userId, kind: "health.reminder", title: w.title, body: w.body, href: w.href })),
  });
  return fresh.length;
}
