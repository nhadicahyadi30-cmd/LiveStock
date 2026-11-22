import { prisma } from "@sl/database";
import { financingPartnerUpsert } from "@sl/validation";
import { ZodError } from "zod";
import { rejectNonOperator } from "@/server/operator";

export const dynamic = "force-dynamic";

// POST /api/operator/financing/partners (header x-operator-token) -> menambah atau mengubah mitra (sertakan id untuk mengubah)
export async function POST(req: Request): Promise<Response> {
  const denied = rejectNonOperator(req); if (denied) return denied;
  let input;
  try { input = financingPartnerUpsert.parse(await req.json()); } catch (e) { return Response.json({ error: { code: "VALIDATION", message: e instanceof ZodError ? e.issues.map((i) => i.message).join("; ") : "Body harus JSON" } }, { status: 400 }); }
  const { id, ...rest } = input;
  const data = { ...rest, minAmount: rest.minAmount ?? null, maxAmount: rest.maxAmount ?? null, rateInfo: rest.rateInfo ?? null, contactUrl: rest.contactUrl ?? null, contactPhone: rest.contactPhone ?? null };
  const row = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.operator', 'on', true) AS o`;
    return id ? tx.financingPartner.update({ where: { id }, data }) : tx.financingPartner.create({ data });
  });
  return Response.json({ data: { id: row.id } }, { status: id ? 200 : 201 });
}
