import { requireFullAccess } from "@/server/finance";
import { loadEligibility } from "@/server/finance-eligibility";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/financing/eligibility -> ringkasan keuangan 6 bulan yang akan dilampirkan ke pengajuan
export const GET = tenantRoute({ permission: "finance.read" }, async (c) => {
  requireFullAccess(c.allowedFarmIds);
  return Response.json({ data: await loadEligibility(c.tx) });
});
