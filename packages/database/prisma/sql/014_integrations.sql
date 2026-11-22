-- 014_integrations.sql : API terbuka dan webhook. Aman dijalankan berulang.
ALTER TABLE public.webhook_deliveries DROP CONSTRAINT IF EXISTS delivery_status_valid;
ALTER TABLE public.webhook_deliveries ADD CONSTRAINT delivery_status_valid CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED'));
ALTER TABLE public.webhook_deliveries DROP CONSTRAINT IF EXISTS deliveries_endpoint_fk;
ALTER TABLE public.webhook_deliveries ADD CONSTRAINT deliveries_endpoint_fk
  FOREIGN KEY (organization_id, endpoint_id) REFERENCES public.webhook_endpoints (organization_id, id) ON DELETE CASCADE;

-- Kunci API dikenali dari hash-nya sebelum organisasi diketahui (mirip token perangkat): hanya SATU baris yang terbuka.
DROP POLICY IF EXISTS api_key_lookup ON public.api_keys;
CREATE POLICY api_key_lookup ON public.api_keys FOR SELECT
  USING (key_hash = NULLIF(current_setting('app.api_key_hash', true), ''));

-- Pengirim webhook (operator) perlu tahu organisasi mana yang punya antrean. Baris PENDING terbuka hanya bila server menyalakan app.webhook_flush.
DROP POLICY IF EXISTS delivery_flush_lookup ON public.webhook_deliveries;
CREATE POLICY delivery_flush_lookup ON public.webhook_deliveries FOR SELECT
  USING (status = 'PENDING' AND current_setting('app.webhook_flush', true) = 'on');
