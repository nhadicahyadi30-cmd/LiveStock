-- 012_vet.sql : Konsultasi dokter hewan. Tabel lintas organisasi dengan RLS khusus. Aman dijalankan berulang.
ALTER TABLE public.vet_consultations DROP CONSTRAINT IF EXISTS vet_consult_status_valid;
ALTER TABLE public.vet_consultations ADD CONSTRAINT vet_consult_status_valid CHECK (status IN ('OPEN', 'ANSWERED', 'CLOSED'));
ALTER TABLE public.vet_consultations DROP CONSTRAINT IF EXISTS vet_consult_not_self;
ALTER TABLE public.vet_consultations ADD CONSTRAINT vet_consult_not_self CHECK (farm_org_id <> vet_org_id);
ALTER TABLE public.vet_consultations DROP CONSTRAINT IF EXISTS vet_consult_vet_fk;
ALTER TABLE public.vet_consultations ADD CONSTRAINT vet_consult_vet_fk FOREIGN KEY (vet_org_id) REFERENCES public.vet_profiles (org_id) ON DELETE RESTRICT;
ALTER TABLE public.vet_messages DROP CONSTRAINT IF EXISTS vet_messages_consult_fk;
ALTER TABLE public.vet_messages ADD CONSTRAINT vet_messages_consult_fk FOREIGN KEY (consultation_id) REFERENCES public.vet_consultations (id) ON DELETE RESTRICT;
ALTER TABLE public.vet_messages DROP CONSTRAINT IF EXISTS vet_messages_body_nonempty;
ALTER TABLE public.vet_messages ADD CONSTRAINT vet_messages_body_nonempty CHECK (length(btrim(body)) > 0);
ALTER TABLE public.vet_messages DROP CONSTRAINT IF EXISTS vet_messages_author_party;
ALTER TABLE public.vet_messages ADD CONSTRAINT vet_messages_author_party CHECK (author_org_id IN (farm_org_id, vet_org_id));

ALTER TABLE public.vet_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vet_profile_select ON public.vet_profiles;
DROP POLICY IF EXISTS vet_profile_write ON public.vet_profiles;
CREATE POLICY vet_profile_select ON public.vet_profiles FOR SELECT USING (true);
CREATE POLICY vet_profile_write ON public.vet_profiles FOR ALL
  USING (org_id = public.app_current_org()) WITH CHECK (org_id = public.app_current_org());

ALTER TABLE public.vet_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_consultations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vet_consult_select ON public.vet_consultations;
DROP POLICY IF EXISTS vet_consult_insert ON public.vet_consultations;
DROP POLICY IF EXISTS vet_consult_update ON public.vet_consultations;
CREATE POLICY vet_consult_select ON public.vet_consultations FOR SELECT
  USING (farm_org_id = public.app_current_org() OR vet_org_id = public.app_current_org());
CREATE POLICY vet_consult_insert ON public.vet_consultations FOR INSERT WITH CHECK (farm_org_id = public.app_current_org());
CREATE POLICY vet_consult_update ON public.vet_consultations FOR UPDATE
  USING (farm_org_id = public.app_current_org() OR vet_org_id = public.app_current_org())
  WITH CHECK (farm_org_id = public.app_current_org() OR vet_org_id = public.app_current_org());
REVOKE DELETE, TRUNCATE ON public.vet_consultations FROM app_user;

ALTER TABLE public.vet_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vet_message_select ON public.vet_messages;
DROP POLICY IF EXISTS vet_message_insert ON public.vet_messages;
CREATE POLICY vet_message_select ON public.vet_messages FOR SELECT
  USING (farm_org_id = public.app_current_org() OR vet_org_id = public.app_current_org());
CREATE POLICY vet_message_insert ON public.vet_messages FOR INSERT WITH CHECK (author_org_id = public.app_current_org());
REVOKE UPDATE, DELETE, TRUNCATE ON public.vet_messages FROM app_user;
