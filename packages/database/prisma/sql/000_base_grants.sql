-- 000_base_grants.sql : hak dasar app_user. Sama dengan docker/postgres/init.sql, tetapi aman diulang.
-- Perlu karena "prisma db push --force-reset" membuat ulang skema public dan menghapus hak ini.
-- Dijalankan sebagai role migrator (pemilik skema). Pembatasan khusus ada di 002_grants.sql dan seterusnya.

GRANT USAGE ON SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
