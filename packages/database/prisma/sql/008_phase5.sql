-- 008_phase5.sql : IoT. Constraint, FK komposit, dan kebijakan pencarian perangkat lewat token. Aman dijalankan berulang.

ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_farm_fk;
ALTER TABLE public.devices ADD CONSTRAINT devices_farm_fk
  FOREIGN KEY (organization_id, farm_id) REFERENCES public.farms (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.sensor_readings DROP CONSTRAINT IF EXISTS readings_device_fk;
ALTER TABLE public.sensor_readings ADD CONSTRAINT readings_device_fk
  FOREIGN KEY (organization_id, device_id) REFERENCES public.devices (organization_id, id) ON DELETE RESTRICT;
ALTER TABLE public.alert_rules DROP CONSTRAINT IF EXISTS rules_device_fk;
ALTER TABLE public.alert_rules ADD CONSTRAINT rules_device_fk
  FOREIGN KEY (organization_id, device_id) REFERENCES public.devices (organization_id, id) ON DELETE RESTRICT;
ALTER TABLE public.alert_events DROP CONSTRAINT IF EXISTS events_device_fk;
ALTER TABLE public.alert_events ADD CONSTRAINT events_device_fk
  FOREIGN KEY (organization_id, device_id) REFERENCES public.devices (organization_id, id) ON DELETE RESTRICT;
ALTER TABLE public.device_commands DROP CONSTRAINT IF EXISTS commands_device_fk;
ALTER TABLE public.device_commands ADD CONSTRAINT commands_device_fk
  FOREIGN KEY (organization_id, device_id) REFERENCES public.devices (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.sensor_readings DROP CONSTRAINT IF EXISTS reading_metric_format;
ALTER TABLE public.sensor_readings ADD CONSTRAINT reading_metric_format CHECK (metric ~ '^[a-z][a-z0-9_]{0,39}$');
ALTER TABLE public.sensor_readings DROP CONSTRAINT IF EXISTS reading_value_finite;
ALTER TABLE public.sensor_readings ADD CONSTRAINT reading_value_finite CHECK (value > -1e9 AND value < 1e9);
ALTER TABLE public.alert_rules DROP CONSTRAINT IF EXISTS rule_metric_format;
ALTER TABLE public.alert_rules ADD CONSTRAINT rule_metric_format CHECK (metric ~ '^[a-z][a-z0-9_]{0,39}$');

-- Perangkat belum punya sesi/organisasi saat mengirim data: ia dikenali dari hash token-nya.
-- Server mengisi app.device_token_hash dalam transaksi; kebijakan ini hanya membuka SATU baris (yang cocok hash).
DROP POLICY IF EXISTS device_token_lookup ON public.devices;
CREATE POLICY device_token_lookup ON public.devices FOR SELECT
  USING (token_hash = NULLIF(current_setting('app.device_token_hash', true), ''));
