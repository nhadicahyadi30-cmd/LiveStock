-- 001_rls.sql : Row Level Security untuk isolasi tenant.
-- Dijalankan sebagai role migrator setelah tabel dibuat (pnpm db:rls). Aman dijalankan berulang.
--
-- Konteks tenant diset aplikasi per transaksi:
--   SELECT set_config('app.organization_id', '<uuid>', true), set_config('app.user_id', '<uuid>', true);
-- Bila konteks tidak diset, fungsi di bawah mengembalikan NULL sehingga tidak ada baris yang cocok (gagal tertutup).

CREATE OR REPLACE FUNCTION public.app_current_org() RETURNS uuid
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION public.app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

-- Kebijakan standar untuk semua tabel yang punya kolom organization_id, kecuali memberships (di bawah).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
     AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organization_id'
      AND c.table_name <> 'memberships'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I '
      'USING (organization_id = public.app_current_org()) '
      'WITH CHECK (organization_id = public.app_current_org())',
      t
    );
  END LOOP;
END
$$;

-- memberships: pengguna harus bisa membaca keanggotaannya sendiri di semua organisasi
-- (untuk memuat daftar organisasi saat login), tetapi hanya menulis di organisasi aktif.
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_select ON public.memberships;
DROP POLICY IF EXISTS membership_write ON public.memberships;
CREATE POLICY membership_select ON public.memberships FOR SELECT
  USING (organization_id = public.app_current_org() OR user_id = public.app_current_user_id());
CREATE POLICY membership_write ON public.memberships FOR ALL
  USING (organization_id = public.app_current_org())
  WITH CHECK (organization_id = public.app_current_org());

-- organizations: tabel ini tidak punya organization_id; kuncinya adalah id.
-- Pembuatan organisasi: aplikasi membuat UUID, set konteks tenant ke UUID itu, lalu INSERT dalam satu transaksi.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_select ON public.organizations;
DROP POLICY IF EXISTS org_write ON public.organizations;
CREATE POLICY org_select ON public.organizations FOR SELECT
  USING (
    id = public.app_current_org()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.organization_id = organizations.id
        AND m.user_id = public.app_current_user_id()
    )
  );
CREATE POLICY org_write ON public.organizations FOR ALL
  USING (id = public.app_current_org())
  WITH CHECK (id = public.app_current_org());

-- TODO (bergantung keputusan penyedia login): tabel users belum memakai RLS.
-- Setelah penyedia login dipilih, batasi pembacaan users ke diri sendiri dan anggota organisasi aktif,
-- dan sediakan fungsi SECURITY DEFINER untuk pencarian email saat login.
