-- 013_billing.sql : Tagihan langganan. Aman dijalankan berulang.
ALTER TABLE public.subscription_invoices DROP CONSTRAINT IF EXISTS sub_invoice_amount_positive;
ALTER TABLE public.subscription_invoices ADD CONSTRAINT sub_invoice_amount_positive CHECK (amount > 0);
ALTER TABLE public.subscription_invoices DROP CONSTRAINT IF EXISTS sub_invoice_months_valid;
ALTER TABLE public.subscription_invoices ADD CONSTRAINT sub_invoice_months_valid CHECK (months IN (1, 3, 6, 12));
ALTER TABLE public.subscription_invoices DROP CONSTRAINT IF EXISTS sub_invoice_status_valid;
ALTER TABLE public.subscription_invoices ADD CONSTRAINT sub_invoice_status_valid CHECK (status IN ('PENDING', 'PAID', 'VOID'));
ALTER TABLE public.subscription_invoices DROP CONSTRAINT IF EXISTS sub_invoice_paid_date;
ALTER TABLE public.subscription_invoices ADD CONSTRAINT sub_invoice_paid_date CHECK ((status = 'PAID') = (paid_at IS NOT NULL));
