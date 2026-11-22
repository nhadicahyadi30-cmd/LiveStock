import { withTenant } from "@sl/database";
import { financingStatusUpdate } from "@sl/validation";
import { ZodError } from "zod";
import { rejectNonOperator } from "@/server/operator";

export const dynamic = "force-dynamic";
const NIL = "00000000-0000-0000-0000-000000000000";

// POST /api/operator/financing/applications (header x-operator-token) -> mencatat keputusan/proses mitra atas pengajuan
export async function POST(req: Request): Promise<Response> {
  const denied = rejectNonOperator(req); if (denied) return denied;
  let input;
  try { input = financingStatusUpdate.parse(await req.json()); } catch (e) { return Response.json({ error: { code: "VALIDATION", message: e instanceof ZodError ? e.issues.map((i) => i.message).join("; ") : "Body harus JSON" } }, { status: 400 }); }
  return withTenant({ organizationId: input.organizationId, userId: NIL }, async (tx) => {
    const upd = await tx.financingApplication.updateMany({ where: { id: input.applicationId, status: { in: ["SUBMITTED", "IN_REVIEW"] } }, data: { status: input.status, partnerNote: input.partnerNote ?? null } });
    if (upd.count === 0) return Response.json({ error: { code: "INVALID_TRANSITION", message: "Pengajuan tidak ditemukan atau sudah diputuskan" } }, { status: 409 });
    await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: null, action: `financing_application.${input.status.toLowerCase()}`, entityType: "financing_application", entityId: input.applicationId } });
    return Response.json({ data: { id: input.applicationId, status: input.status } });
  });
}
