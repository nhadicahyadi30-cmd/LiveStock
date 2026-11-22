-- 010_logistics.sql : Pengiriman pesanan pasar. Tabel lintas organisasi (pembeli dan penjual), RLS khusus. Aman dijalankan berulang.
ALTER TABLE public.market_shipments DROP CONSTRAINT IF EXISTS shipment_fee_nonneg;
ALTER TABLE public.market_shipments ADD CONSTRAINT shipment_fee_nonneg CHECK (fee >= 0);
ALTER TABLE public.market_shipments DROP CONSTRAINT IF EXISTS shipment_method_valid;
ALTER TABLE public.market_shipments ADD CONSTRAINT shipment_method_valid CHECK (method IN ('KURIR', 'ANTAR_SENDIRI', 'AMBIL_SENDIRI'));
ALTER TABLE public.market_shipments DROP CONSTRAINT IF EXISTS shipments_order_fk;
ALTER TABLE public.market_shipments ADD CONSTRAINT shipments_order_fk FOREIGN KEY (order_id) REFERENCES public.market_orders (id) ON DELETE RESTRICT;
ALTER TABLE public.market_shipment_events DROP CONSTRAINT IF EXISTS shipment_events_fk;
ALTER TABLE public.market_shipment_events ADD CONSTRAINT shipment_events_fk FOREIGN KEY (shipment_id) REFERENCES public.market_shipments (id) ON DELETE RESTRICT;

ALTER TABLE public.market_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_shipments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shipment_select ON public.market_shipments;
DROP POLICY IF EXISTS shipment_insert ON public.market_shipments;
DROP POLICY IF EXISTS shipment_update ON public.market_shipments;
CREATE POLICY shipment_select ON public.market_shipments FOR SELECT
  USING (seller_org_id = public.app_current_org() OR buyer_org_id = public.app_current_org());
CREATE POLICY shipment_insert ON public.market_shipments FOR INSERT WITH CHECK (seller_org_id = public.app_current_org());
CREATE POLICY shipment_update ON public.market_shipments FOR UPDATE
  USING (seller_org_id = public.app_current_org()) WITH CHECK (seller_org_id = public.app_current_org());
REVOKE DELETE, TRUNCATE ON public.market_shipments FROM app_user;

ALTER TABLE public.market_shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_shipment_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shipment_event_select ON public.market_shipment_events;
DROP POLICY IF EXISTS shipment_event_insert ON public.market_shipment_events;
CREATE POLICY shipment_event_select ON public.market_shipment_events FOR SELECT
  USING (seller_org_id = public.app_current_org() OR buyer_org_id = public.app_current_org());
CREATE POLICY shipment_event_insert ON public.market_shipment_events FOR INSERT WITH CHECK (seller_org_id = public.app_current_org());
REVOKE UPDATE, DELETE, TRUNCATE ON public.market_shipment_events FROM app_user;
