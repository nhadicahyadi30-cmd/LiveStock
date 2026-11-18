-- 007_phase4.sql : constraint dan foreign key komposit untuk Keuangan. Aman dijalankan berulang.

ALTER TABLE public.finance_entries DROP CONSTRAINT IF EXISTS finance_amount_positive;
ALTER TABLE public.finance_entries ADD CONSTRAINT finance_amount_positive CHECK (amount > 0);
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budget_amount_nonneg;
ALTER TABLE public.budgets ADD CONSTRAINT budget_amount_nonneg CHECK (amount >= 0);
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budget_month_format;
ALTER TABLE public.budgets ADD CONSTRAINT budget_month_format CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoice_amount_positive;
ALTER TABLE public.invoices ADD CONSTRAINT invoice_amount_positive CHECK (amount > 0);
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoice_due_after_issue;
ALTER TABLE public.invoices ADD CONSTRAINT invoice_due_after_issue CHECK (due_on >= issue_on);
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoice_paid_date;
ALTER TABLE public.invoices ADD CONSTRAINT invoice_paid_date CHECK ((status = 'PAID') = (paid_on IS NOT NULL));

ALTER TABLE public.finance_entries DROP CONSTRAINT IF EXISTS finance_entries_batch_fk;
ALTER TABLE public.finance_entries ADD CONSTRAINT finance_entries_batch_fk
  FOREIGN KEY (organization_id, batch_id) REFERENCES public.livestock_batches (organization_id, id) ON DELETE RESTRICT;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_batch_fk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_batch_fk
  FOREIGN KEY (organization_id, batch_id) REFERENCES public.livestock_batches (organization_id, id) ON DELETE RESTRICT;
