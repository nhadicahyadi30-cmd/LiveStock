import { timingSafeEqual } from "node:crypto";

/** Memeriksa header x-operator-token. Mengembalikan Response galat bila ditolak, atau null bila lolos. */
export function rejectNonOperator(req: Request): Response | null {
  const secret = process.env.BILLING_OPERATOR_TOKEN ?? "";
  if (secret.length < 24) return Response.json({ error: { code: "OPERATOR_DISABLED", message: "BILLING_OPERATOR_TOKEN belum diatur di server" } }, { status: 503 });
  const given = Buffer.from(req.headers.get("x-operator-token") ?? ""); const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return Response.json({ error: { code: "UNAUTHORIZED", message: "Token operator salah" } }, { status: 401 });
  return null;
}
