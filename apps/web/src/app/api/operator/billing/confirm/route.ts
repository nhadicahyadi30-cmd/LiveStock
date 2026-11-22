import { timingSafeEqual } from "node:crypto";
import { withTenant } from "@sl/database";
import { operatorConfirm } from "@sl/validation";
import { ZodError } from "zod";
import { extendExpiry, type PlanId } from "@/server/plans";

export const dynamic = "force-dynamic";

const NIL = "00000000-0000-0000-0000-000000000000";
const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

// POST /api/operator/billing/confirm  (header x-operator-token) { organizationId, number }
// Dipakai pemilik platform setelah melihat transfer masuk. Mengaktifkan paket sampai masa aktif baru.
// Mati (503) bila BILLING_OPERATOR_TOKEN belum diisi atau kurang dari 24 karakter.
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.BILLING_OPERATOR_TOKEN ?? "";
  if (secret.length < 24) return fail(503, "OPERATOR_DISABLED", "BILLING_OPERATOR_TOKEN belum diatur di server");
  const given = Buffer.from(req.headers.get("x-operator-token") ?? "");
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return fail(401, "UNAUTHORIZED", "Token operator salah");
  let input;
  try { input = operatorConfirm.parse(await req.json()); } catch (e) { return e instanceof ZodError ? fail(400, "VALIDATION", "Data tidak valid") : fail(400, "BAD_REQUEST", "Body harus JSON"); }

  return withTenant({ organizationId: input.organizationId, userId: NIL }, async (tx) => {
    const inv = await tx.subscriptionInvoice.findUnique({ where: { organizationId_number: { organizationId: input.organizationId, number: input.number } } });
    if (!inv) return fail(404, "NOT_FOUND", "Tagihan tidak ditemukan");
    if (inv.status !== "PENDING") return fail(409, "INVALID_TRANSITION", `Tagihan berstatus ${inv.status}`);
    const org = await tx.organization.findUnique({ where: { id: input.organizationId }, select: { plan: true, planExpiresAt: true } });
    if (!org) return fail(404, "NOT_FOUND", "Organisasi tidak ditemukan");
    // Ganti paket: masa aktif baru dihitung dari sisa masa aktif hanya bila paketnya sama.
    const expires = extendExpiry(org.plan === inv.plan ? org.planExpiresAt : null, inv.months);
    await tx.subscriptionInvoice.update({ where: { id: inv.id }, data: { status: "PAID", paidAt: new Date() } });
    await tx.organization.update({ where: { id: input.organizationId }, data: { plan: inv.plan as PlanId, planExpiresAt: expires } });
    await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: null, action: "subscription.activate", entityType: "subscription_invoice", entityId: inv.id, after: { plan: inv.plan, expiresAt: expires.toISOString() } } });
    return Response.json({ data: { plan: inv.plan, expiresAt: expires } });
  });
}
