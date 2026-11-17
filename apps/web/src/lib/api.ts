// Pembungkus fetch untuk klien. Cookie sesi dikirim otomatis (same-origin).
export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Galat jaringan (offline, server tak terjangkau): tidak ada respons sama sekali. */
export class NetworkFailure extends Error {}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new NetworkFailure("Tidak ada koneksi");
  }
  const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string; details?: unknown } } | null;
  if (!res.ok) {
    throw new ApiFailure(res.status, json?.error?.code ?? "UNKNOWN", json?.error?.message ?? "Terjadi kesalahan", json?.error?.details);
  }
  return json as T;
}
