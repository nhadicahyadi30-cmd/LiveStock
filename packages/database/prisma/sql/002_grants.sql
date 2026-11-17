-- 002_grants.sql : pembatasan hak akses app_user di atas default privilege (lihat docker/postgres/init.sql).
-- Dijalankan sebagai role migrator. Aman dijalankan berulang.

-- Jejak audit hanya boleh ditambah dan dibaca.
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM app_user;

-- Referensi global hanya boleh dibaca; perubahan lewat seed atau migrasi.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.species FROM app_user;

GRANT EXECUTE ON FUNCTION public.app_current_org() TO app_user;
GRANT EXECUTE ON FUNCTION public.app_current_user_id() TO app_user;
