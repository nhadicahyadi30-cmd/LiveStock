import type { Tx } from "@sl/database";
import { ApiError } from "./errors";
import { PLANS, canAdd, effectivePlan, limitFor, type PlanId, type Resource } from "./plans";

export async function currentPlan(tx: Tx, organizationId: string): Promise<{ plan: PlanId; stored: PlanId; expiresAt: Date | null }> {
  const o = await tx.organization.findUnique({ where: { id: organizationId }, select: { plan: true, planExpiresAt: true } });
  const stored = (o?.plan ?? "FREE") as PlanId;
  return { plan: effectivePlan(stored, o?.planExpiresAt ?? null), stored, expiresAt: o?.planExpiresAt ?? null };
}

export async function usage(tx: Tx, organizationId: string): Promise<Record<Resource, number>> {
  const [farms, members, pending, devices] = await Promise.all([
    tx.farm.count(),
    tx.membership.count({ where: { status: "ACTIVE" } }),
    tx.authToken.count({ where: { kind: "INVITE", targetOrgId: organizationId, usedAt: null, expiresAt: { gt: new Date() } } }).catch(() => 0),
    tx.device.count(),
  ]);
  return { farms, members: members + pending, devices };
}

/** Melempar 402 bila menambah satu sumber daya lagi melewati batas paket. */
export async function assertWithinPlan(tx: Tx, organizationId: string, resource: Resource): Promise<void> {
  const { plan } = await currentPlan(tx, organizationId);
  const u = await usage(tx, organizationId);
  if (!canAdd(plan, resource, u[resource])) {
    const lim = limitFor(plan, resource);
    const label = { farms: "farm", members: "anggota", devices: "perangkat IoT" }[resource];
    throw new ApiError(402, "PLAN_LIMIT", `Paket ${PLANS[plan].name} dibatasi ${lim} ${label}. Tingkatkan paket di menu Langganan.`);
  }
}
