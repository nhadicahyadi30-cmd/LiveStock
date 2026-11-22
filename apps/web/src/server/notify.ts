import type { Tx } from "@sl/database";

/** Memberi notifikasi ke OWNER dan MANAGER organisasi lain (lewat fungsi SQL notify_org_roles, lihat sql/017_notify.sql). */
export async function notifyOrg(tx: Tx, orgId: string, n: { kind: `market.${string}` | `vet.${string}` | `billing.${string}`; title: string; body?: string | undefined; href?: string | undefined }): Promise<void> {
  await tx.$queryRaw`SELECT public.notify_org_roles(${orgId}::uuid, ARRAY['OWNER','MANAGER']::text[], ${n.kind}::text, ${n.title}::text, ${n.body ?? ""}::text, ${n.href ?? ""}::text)`;
}
