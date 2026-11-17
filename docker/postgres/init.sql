-- Dijalankan sekali saat database dibuat (dev dan CI).
-- migrator : pemilik skema, menjalankan migrasi (CREATEDB agar Prisma dapat membuat shadow database).
-- app_user : dipakai aplikasi; bukan superuser dan tanpa BYPASSRLS sehingga RLS selalu berlaku.
-- Kata sandi di bawah hanya untuk pengembangan lokal. Ganti di staging dan production.

CREATE ROLE migrator LOGIN PASSWORD 'migrator_dev' CREATEDB NOSUPERUSER NOBYPASSRLS;
CREATE ROLE app_user LOGIN PASSWORD 'app_user_dev' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

ALTER DATABASE smart_livestock OWNER TO migrator;
ALTER SCHEMA public OWNER TO migrator;

GRANT USAGE ON SCHEMA public TO app_user;

-- Tabel dan sequence baru buatan migrator otomatis dapat dipakai app_user.
-- Pembatasan khusus (audit_logs, species, breeds) diatur di packages/database/prisma/sql/002_grants.sql.
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
