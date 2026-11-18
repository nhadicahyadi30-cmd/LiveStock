-- 004_phase1.sql : constraint dan foreign key komposit untuk pakan, produksi, tugas, notifikasi.
-- Dijalankan setelah `prisma db push` (db push bisa menghapus FK yang tidak ada di schema.prisma, jadi selalu jalankan db:rls sesudahnya).
-- Aman dijalankan berulang.

ALTER TABLE public.feed_records DROP CONSTRAINT IF EXISTS feed_qty_positive;
ALTER TABLE public.feed_records ADD CONSTRAINT feed_qty_positive CHECK (quantity_kg > 0);
ALTER TABLE public.feed_records DROP CONSTRAINT IF EXISTS feed_cost_nonneg;
ALTER TABLE public.feed_records ADD CONSTRAINT feed_cost_nonneg CHECK (cost_total IS NULL OR cost_total >= 0);

ALTER TABLE public.production_records DROP CONSTRAINT IF EXISTS production_qty_positive;
ALTER TABLE public.production_records ADD CONSTRAINT production_qty_positive CHECK (quantity > 0);

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS task_title_nonempty;
ALTER TABLE public.tasks ADD CONSTRAINT task_title_nonempty CHECK (length(btrim(title)) > 0);

-- Foreign key komposit (organization_id, id): data tidak bisa menunjuk baris milik organisasi lain.
ALTER TABLE public.feed_records DROP CONSTRAINT IF EXISTS feed_records_batch_fk;
ALTER TABLE public.feed_records ADD CONSTRAINT feed_records_batch_fk
  FOREIGN KEY (organization_id, batch_id) REFERENCES public.livestock_batches (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.feed_records DROP CONSTRAINT IF EXISTS feed_records_type_fk;
ALTER TABLE public.feed_records ADD CONSTRAINT feed_records_type_fk
  FOREIGN KEY (organization_id, feed_type_id) REFERENCES public.feed_types (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.production_records DROP CONSTRAINT IF EXISTS production_records_batch_fk;
ALTER TABLE public.production_records ADD CONSTRAINT production_records_batch_fk
  FOREIGN KEY (organization_id, batch_id) REFERENCES public.livestock_batches (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_batch_fk;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_batch_fk
  FOREIGN KEY (organization_id, batch_id) REFERENCES public.livestock_batches (organization_id, id) ON DELETE RESTRICT;
