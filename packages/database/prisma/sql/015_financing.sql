-- 015_financing.sql : Pembiayaan dan mitra. Aman dijalankan berulang.
ALTER TABLE public.financing_applications DROP CONSTRAINT IF EXISTS fin_app_amount_positive;
ALTER TABLE public.financing_applications ADD CONSTRAINT fin_app_amount_positive CHECK (amount > 0);
ALTER TABLE public.financing_applications DROP CONSTRAINT IF EXISTS fin_app_tenor_range;
ALTER TABLE public.financing_applications ADD CONSTRAINT fin_app_tenor_range CHECK (tenor_months BETWEEN 1 AND 60);
ALTER TABLE public.financing_applications DROP CONSTRAINT IF EXISTS fin_app_status_valid;
ALTER TABLE public.financing_applications ADD CONSTRAINT fin_app_status_valid CHECK (status IN ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'));
ALTER TABLE public.financing_applications DROP CONSTRAINT IF EXISTS fin_app_partner_fk;
ALTER TABLE public.financing_applications ADD CONSTRAINT fin_app_partner_fk FOREIGN KEY (partner_id) REFERENCES public.financing_partners (id) ON DELETE RESTRICT;
ALTER TABLE public.financing_partners DROP CONSTRAINT IF EXISTS fin_partner_kind_valid;
ALTER TABLE public.financing_partners ADD CONSTRAINT fin_partner_kind_valid CHECK (kind IN ('BANK', 'KOPERASI', 'FINTECH', 'OFFTAKER', 'LAINNYA'));

-- Mitra dibaca semua organisasi (yang aktif). Ditulis hanya oleh operator: server menyalakan app.operator dalam transaksinya.
ALTER TABLE public.financing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_partners FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fin_partner_select ON public.financing_partners;
DROP POLICY IF EXISTS fin_partner_operator ON public.financing_partners;
CREATE POLICY fin_partner_select ON public.financing_partners FOR SELECT
  USING (active OR current_setting('app.operator', true) = 'on');
CREATE POLICY fin_partner_operator ON public.financing_partners FOR ALL
  USING (current_setting('app.operator', true) = 'on') WITH CHECK (current_setting('app.operator', true) = 'on');
REVOKE DELETE, TRUNCATE ON public.financing_partners FROM app_user;
