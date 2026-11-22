import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/vet/vets -> daftar dokter hewan yang menerima konsultasi (tanpa organisasi sendiri)
export const GET = tenantRoute({ permission: "records.read" }, async (c) => {
  const rows = await c.tx.vetProfile.findMany({ where: { accepting: true, orgId: { not: c.organizationId } }, orderBy: { displayName: "asc" }, take: 100 });
  return Response.json({ data: rows.map((v) => ({ orgId: v.orgId, displayName: v.displayName, city: v.city, specialty: v.specialty, licenseNo: v.licenseNo, about: v.about })) });
});
