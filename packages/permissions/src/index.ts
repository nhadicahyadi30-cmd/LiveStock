// Matriks role dan izin MVP (bagian "Peran dan hak akses" di dokumen spesifikasi).
// Role memakai enum dulu; tabel roles/permissions baru dibuat bila ada kebutuhan role kustom.
//
// Paket ini hanya menjawab "role ini boleh melakukan apa". Pembatasan per farm (membership_farms)
// dan per organisasi diperiksa di lapisan server (lihat apps/web/src/server/tenant-guard.ts).

export const ROLES = ["OWNER", "MANAGER", "WORKER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "org.manage",
  "members.read",
  "members.manage",
  "billing.manage",
  "farm.read",
  "farm.write",
  "livestock.read",
  "livestock.write",
  "records.read",
  "records.create",
  "records.correct",
  "tasks.read",
  "tasks.manage",
  "tasks.complete",
  "dashboard.read",
  "reports.export",
  "audit.read",
  "market.read",
  "market.manage",
  "finance.read",
  "finance.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const READ_ONLY: readonly Permission[] = [
  "farm.read",
  "livestock.read",
  "records.read",
  "tasks.read",
  "dashboard.read",
];

const MATRIX: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  MANAGER: [
    ...READ_ONLY,
    "members.read",
    "farm.write",
    "livestock.write",
    "records.create",
    "records.correct",
    "tasks.manage",
    "tasks.complete",
    "reports.export",
    "audit.read",
    "market.read",
    "market.manage",
    "finance.read",
    "finance.manage",
  ],
  WORKER: [...READ_ONLY, "livestock.write", "records.create", "tasks.complete"],
  VIEWER: [...READ_ONLY, "reports.export"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return MATRIX[role];
}

/** Petugas kandang hanya boleh mengubah catatannya sendiri dalam jendela waktu ini. */
export const WORKER_EDIT_WINDOW_HOURS = 24;

export interface RecordEditInput {
  role: Role;
  userId: string;
  recordedBy: string;
  createdAt: Date;
  now?: Date;
}

/**
 * Apakah pengguna boleh mengoreksi sebuah catatan operasional.
 * Owner dan Manajer: selalu (records.correct). Petugas: hanya catatan sendiri dalam 24 jam. Pengamat: tidak.
 */
export function canEditRecord({ role, userId, recordedBy, createdAt, now = new Date() }: RecordEditInput): boolean {
  if (can(role, "records.correct")) return true;
  if (role !== "WORKER") return false;
  if (recordedBy !== userId) return false;
  const ageMs = now.getTime() - createdAt.getTime();
  return ageMs >= 0 && ageMs <= WORKER_EDIT_WINDOW_HOURS * 60 * 60 * 1000;
}
