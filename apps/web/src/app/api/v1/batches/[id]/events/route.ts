import { can } from "@sl/permissions";
import { batchEventCreate, batchEventDelta, uuid } from "@sl/validation";
import { ApiError } from "@/server/errors";
import { clientIp, writeAudit } from "@/server/audit";
import { resolveTarget } from "@/server/record-target";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// POST /api/v1/batches/:id/events -> jual, afkir, tambah, atau koreksi populasi batch (izin livestock.write).
// Populasi tidak boleh negatif: dijaga trigger database (galat 23514 dipetakan ke 409 di bawah).
export const POST = tenantRoute<{ id: string }>({ permission: "livestock.write" }, async (c) => {
  const batchId = uuid.parse(c.params.id);
  const input = batchEventCreate.parse(await c.req.json());
  await resolveTarget(c, { batchId });

  if (input.clientId) {
    const existing = await c.tx.batchEvent.findUnique({ where: { organizationId_clientId: { organizationId: c.organizationId, clientId: input.clientId } } });
    if (existing) return Response.json({ data: existing }, { status: 200 });
  }

  // Harga jual mencatat pemasukan di Keuangan: hanya untuk peran dengan izin keuangan dan akses semua farm.
  if (input.totalPrice !== undefined && (!can(c.role, "finance.manage") || c.allowedFarmIds !== null)) {
    throw new ApiError(403, "FORBIDDEN", "Mencatat harga jual butuh izin keuangan. Kosongkan harga, lalu catat pemasukan lewat Keuangan.");
  }

  const pop = await c.tx.$queryRaw<{ current_count: bigint }[]>`SELECT current_count FROM batch_population WHERE batch_id = ${batchId}::uuid`;
  const current = Number(pop[0]?.current_count ?? 0);
  const delta = batchEventDelta(input);
  if (current + delta < 0) {
    throw new ApiError(409, "POPULATION_NEGATIVE", `Jumlah melebihi populasi saat ini (${current} ekor)`);
  }

  const event = await c.tx.batchEvent.create({
    data: { organizationId: c.organizationId, batchId, eventType: input.eventType, delta, occurredOn: input.occurredOn, note: input.note, recordedBy: c.userId, clientId: input.clientId },
  });
  await writeAudit(
    c.tx,
    { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) },
    { action: "batch_event.create", entityType: "batch_event", entityId: event.id, after: { type: input.eventType, delta } },
  );
  if (input.totalPrice !== undefined) {
    const batch = await c.tx.livestockBatch.findUnique({ where: { organizationId_id: { organizationId: c.organizationId, id: batchId } }, select: { code: true } });
    const fe = await c.tx.financeEntry.create({ data: { organizationId: c.organizationId, kind: "INCOME", category: "PENJUALAN_TERNAK", amount: input.totalPrice, occurredOn: input.occurredOn, batchId, description: `Penjualan ${input.count} ekor ${batch?.code ?? ""}`.trim(), recordedBy: c.userId, clientId: input.clientId ?? null } });
    await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "finance_entry.create", entityType: "finance_entry", entityId: fe.id, after: { kind: "INCOME", category: "PENJUALAN_TERNAK", amount: input.totalPrice, via: "batch_event" } });
  }
  return Response.json({ data: event }, { status: 201 });
});
