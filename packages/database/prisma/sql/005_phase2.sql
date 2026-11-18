-- 005_phase2.sql : constraint dan foreign key komposit untuk modul Kesehatan. Aman dijalankan berulang.

ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_title_nonempty;
ALTER TABLE public.health_records ADD CONSTRAINT health_title_nonempty CHECK (length(btrim(title)) > 0);
ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_count_positive;
ALTER TABLE public.health_records ADD CONSTRAINT health_count_positive CHECK (affected_count IS NULL OR affected_count > 0);
ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_cost_nonneg;
ALTER TABLE public.health_records ADD CONSTRAINT health_cost_nonneg CHECK (cost IS NULL OR cost >= 0);
ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_done_after_start;
ALTER TABLE public.health_records ADD CONSTRAINT health_done_after_start CHECK (done_on IS NULL OR done_on >= event_on OR kind = 'VACCINATION');
ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_status_done_date;
ALTER TABLE public.health_records ADD CONSTRAINT health_status_done_date CHECK ((status = 'DONE') = (done_on IS NOT NULL));

ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_records_batch_fk;
ALTER TABLE public.health_records ADD CONSTRAINT health_records_batch_fk
  FOREIGN KEY (organization_id, batch_id) REFERENCES public.livestock_batches (organization_id, id) ON DELETE RESTRICT;
