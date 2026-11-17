import { Prisma } from "@sl/database";

/** Galat yang aman ditampilkan ke klien: status, kode yang terdokumentasi, dan pesan. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function body(status: number, code: string, message: string, requestId: string, details?: unknown): Response {
  const error: Record<string, unknown> = { code, message, requestId };
  if (details !== undefined) error.details = details;
  return Response.json({ error }, { status });
}

/** Mengubah galat apa pun menjadi respons JSON seragam. Galat tak dikenal tidak membocorkan detail. */
export function errorResponse(err: unknown, requestId: string): Response {
  if (err instanceof ApiError) {
    return body(err.status, err.code, err.message, requestId, err.details);
  }

  if (err instanceof Error && err.name === "ZodError" && "flatten" in err) {
    const flatten = (err as unknown as { flatten: () => unknown }).flatten();
    return body(422, "VALIDATION_ERROR", "Data tidak valid", requestId, flatten);
  }

  if (err instanceof SyntaxError) {
    return body(400, "INVALID_JSON", "Body request bukan JSON yang valid", requestId);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return body(409, "CONFLICT", "Data dengan nilai unik yang sama sudah ada", requestId);
    }
    if (err.code === "P2003") {
      return body(409, "REFERENCE_ERROR", "Data merujuk ke baris yang tidak ada atau tidak boleh diakses", requestId);
    }
    if (err.code === "P2025") {
      return body(404, "NOT_FOUND", "Data tidak ditemukan", requestId);
    }
  }

  console.error(JSON.stringify({ level: "error", requestId, message: "Unhandled API error" }), err);
  return body(500, "INTERNAL_ERROR", "Terjadi kesalahan pada server", requestId);
}

/**
 * Pembungkus semua route handler: membuat request id, menangani galat, dan menambahkan header x-request-id.
 */
export async function apiRoute(req: Request, fn: (requestId: string) => Promise<Response>): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  let res: Response;
  try {
    res = await fn(requestId);
  } catch (err) {
    res = errorResponse(err, requestId);
  }
  res.headers.set("x-request-id", requestId);
  return res;
}
