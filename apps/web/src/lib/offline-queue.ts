// Antrean catatan offline sederhana (localStorage). Setiap catatan membawa clientId, jadi mengirim ulang aman:
// server mengembalikan catatan yang sama, tidak membuat duplikat.
// Batasan MVP: localStorage ~5 MB dan hanya dibaca di halaman yang terbuka; service worker dan IndexedDB menyusul.
import { api, ApiFailure, NetworkFailure } from "./api";

export interface QueuedRecord {
  clientId: string;
  path: "/weight-records" | "/mortality-records";
  body: Record<string, unknown>;
  queuedAt: string;
  /** Galat validasi dari server; catatan ini tidak dikirim ulang sebelum diperbaiki atau dibuang. */
  error?: string;
}

const KEY = "sl.queue.v1";

export function readQueue(): QueuedRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedRecord[];
  } catch {
    return [];
  }
}
function writeQueue(q: QueuedRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    throw new Error("Penyimpanan perangkat penuh; sambungkan internet untuk mengirim catatan.");
  }
}

export function enqueue(path: QueuedRecord["path"], body: Record<string, unknown>): QueuedRecord {
  const clientId = (body.clientId as string | undefined) ?? crypto.randomUUID();
  const item: QueuedRecord = { clientId, path, body: { ...body, clientId }, queuedAt: new Date().toISOString() };
  writeQueue([...readQueue(), item]);
  return item;
}

export function discard(clientId: string): void {
  writeQueue(readQueue().filter((i) => i.clientId !== clientId));
}

/** Mengirim antrean berurutan. Berhenti saat jaringan putus; menandai catatan yang ditolak server. */
export async function flushQueue(): Promise<{ sent: number; failed: number; remaining: number }> {
  let sent = 0;
  let failed = 0;
  for (const item of readQueue()) {
    if (item.error) {
      failed++;
      continue;
    }
    try {
      await api(item.path, { body: item.body });
      discard(item.clientId);
      sent++;
    } catch (e) {
      if (e instanceof NetworkFailure) break;
      if (e instanceof ApiFailure && e.status === 401) break; // sesi habis: coba lagi setelah masuk
      const msg = e instanceof Error ? e.message : "Ditolak server";
      writeQueue(readQueue().map((i) => (i.clientId === item.clientId ? { ...i, error: msg } : i)));
      failed++;
    }
  }
  return { sent, failed, remaining: readQueue().length };
}
