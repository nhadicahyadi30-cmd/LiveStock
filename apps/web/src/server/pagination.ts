import { ApiError } from "./errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Pagination {
  limit: number;
  cursor: string | undefined;
}

/** Paginasi kursor: ?limit=1..100 (bawaan 50) dan ?cursor=<id>. Urutan berdasarkan id (UUID v7 terurut waktu). */
export function parsePagination(url: URL): Pagination {
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw === null ? 50 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, "INVALID_PAGINATION", "limit harus bilangan bulat 1 sampai 100");
  }

  const cursor = url.searchParams.get("cursor") ?? undefined;
  if (cursor !== undefined && !UUID_RE.test(cursor)) {
    throw new ApiError(400, "INVALID_PAGINATION", "cursor tidak valid");
  }

  return { limit, cursor };
}

/** Query diminta limit + 1 baris; baris ekstra menandakan masih ada halaman berikutnya. */
export function pageOf<T extends { id: string }>(rows: T[], limit: number): { data: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null };
}
