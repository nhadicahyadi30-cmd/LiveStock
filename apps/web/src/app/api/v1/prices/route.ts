import { PRICE_COMMODITIES, priceCreate } from "@sl/validation";
import { clientIp, writeAudit } from "@/server/audit";
import { forecastPrice } from "@/server/price-forecast";
import { tenantRoute } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

// GET /api/v1/prices -> ringkasan per komoditas (harga terakhir, tren, perkiraan) + 20 catatan terbaru
export const GET = tenantRoute({ permission: "market.read" }, async (c) => {
  const since = new Date(Date.now() - 180 * 864e5);
  const rows = await c.tx.marketPrice.findMany({ where: { voidedAt: null, observedOn: { gte: since } }, orderBy: [{ observedOn: "asc" }, { createdAt: "asc" }], take: 5000 });
  const byCommodity = new Map<string, typeof rows>();
  for (const r of rows) byCommodity.set(r.commodity, [...(byCommodity.get(r.commodity) ?? []), r]);
  const summary = [...byCommodity.entries()].map(([commodity, list]) => ({
    commodity, unit: list.at(-1)!.unit,
    series: list.slice(-24).map((r) => ({ date: r.observedOn.toISOString().slice(0, 10), price: Number(r.price) })),
    forecast: forecastPrice(list.map((r) => ({ date: r.observedOn, price: Number(r.price) }))),
  }));
  const recent = [...rows].reverse().slice(0, 20).map((r) => ({ id: r.id, commodity: r.commodity, unit: r.unit, price: Number(r.price), region: r.region, source: r.source, observedOn: r.observedOn.toISOString().slice(0, 10) }));
  return Response.json({ data: { commodities: PRICE_COMMODITIES, summary, recent } });
});

// POST /api/v1/prices
export const POST = tenantRoute({ permission: "market.manage" }, async (c) => {
  const input = priceCreate.parse(await c.req.json());
  const row = await c.tx.marketPrice.create({ data: { ...input, organizationId: c.organizationId, recordedBy: c.userId } });
  await writeAudit(c.tx, { organizationId: c.organizationId, actorId: c.userId, ipAddress: clientIp(c.req) }, { action: "market_price.create", entityType: "market_price", entityId: row.id, after: { commodity: row.commodity, price: Number(row.price) } });
  return Response.json({ data: { id: row.id } }, { status: 201 });
});
