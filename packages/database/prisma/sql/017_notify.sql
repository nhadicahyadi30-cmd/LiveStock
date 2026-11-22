-- 017_notify.sql : notifikasi lintas organisasi (mis. pembeli memesan -> penjual diberi tahu).
-- RLS melarang menulis notifikasi untuk organisasi lain. Fungsi ini memindahkan konteks organisasi SEMENTARA di dalam fungsi,
-- menulis notifikasi untuk OWNER/MANAGER (atau peran yang diminta) organisasi tujuan, lalu mengembalikan konteks semula.
-- Aman dijalankan berulang.
CREATE OR REPLACE FUNCTION public.notify_org_roles(p_org uuid, p_roles text[], p_kind text, p_title text, p_body text, p_href text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  prev text := current_setting('app.organization_id', true);
  n integer;
BEGIN
  IF p_kind !~ '^(market|vet|billing)\.[a-z_]+$' THEN
    RAISE EXCEPTION 'jenis notifikasi tidak diizinkan: %', p_kind;
  END IF;
  PERFORM set_config('app.organization_id', p_org::text, true);
  INSERT INTO public.notifications (id, organization_id, user_id, kind, title, body, href)
  SELECT gen_random_uuid(), p_org, m.user_id, p_kind, left(p_title, 200), left(p_body, 500), p_href
  FROM public.memberships m
  WHERE m.organization_id = p_org AND m.status = 'ACTIVE' AND m.role::text = ANY (p_roles);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.organization_id', COALESCE(prev, ''), true);
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_org_roles(uuid, text[], text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_org_roles(uuid, text[], text, text, text, text) TO app_user;
