-- 011_escrow.sql : Pembayaran pesanan pasar (rekening bersama, mode manual). Aman dijalankan berulang.
ALTER TABLE public.market_payments DROP CONSTRAINT IF EXISTS payment_amount_positive;
ALTER TABLE public.market_payments ADD CONSTRAINT payment_amount_positive CHECK (amount > 0);
ALTER TABLE public.market_payments DROP CONSTRAINT IF EXISTS payment_status_valid;
ALTER TABLE public.market_payments ADD CONSTRAINT payment_status_valid CHECK (status IN ('AWAITING', 'PROOF_SUBMITTED', 'HELD', 'RELEASED', 'DISPUTED', 'REFUNDED'));
ALTER TABLE public.market_payments DROP CONSTRAINT IF EXISTS payment_method_valid;
ALTER TABLE public.market_payments ADD CONSTRAINT payment_method_valid CHECK (method IN ('TRANSFER', 'QRIS', 'COD'));
ALTER TABLE public.market_payments DROP CONSTRAINT IF EXISTS payments_order_fk;
ALTER TABLE public.market_payments ADD CONSTRAINT payments_order_fk FOREIGN KEY (order_id) REFERENCES public.market_orders (id) ON DELETE RESTRICT;

ALTER TABLE public.market_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_select ON public.market_payments;
DROP POLICY IF EXISTS payment_insert ON public.market_payments;
DROP POLICY IF EXISTS payment_update ON public.market_payments;
CREATE POLICY payment_select ON public.market_payments FOR SELECT
  USING (buyer_org_id = public.app_current_org() OR seller_org_id = public.app_current_org());
CREATE POLICY payment_insert ON public.market_payments FOR INSERT WITH CHECK (buyer_org_id = public.app_current_org());
CREATE POLICY payment_update ON public.market_payments FOR UPDATE
  USING (buyer_org_id = public.app_current_org() OR seller_org_id = public.app_current_org())
  WITH CHECK (buyer_org_id = public.app_current_org() OR seller_org_id = public.app_current_org());
REVOKE DELETE, TRUNCATE ON public.market_payments FROM app_user;
