-- 003_constraints.sql : CHECK, view, dan trigger yang tidak bisa dinyatakan di schema.prisma.
-- Dijalankan sebagai role migrator. Aman dijalankan berulang. Butuh PostgreSQL 15 atau lebih baru (security_invoker).

-- Satu target per catatan: tepat satu dari animal_id atau batch_id.
ALTER TABLE public.weight_records DROP CONSTRAINT IF EXISTS weight_one_target;
ALTER TABLE public.weight_records ADD CONSTRAINT weight_one_target
  CHECK ((animal_id IS NOT NULL)::int + (batch_id IS NOT NULL)::int = 1);

ALTER TABLE public.mortality_records DROP CONSTRAINT IF EXISTS mortality_one_target;
ALTER TABLE public.mortality_records ADD CONSTRAINT mortality_one_target
  CHECK ((animal_id IS NOT NULL)::int + (batch_id IS NOT NULL)::int = 1);

-- Nilai yang masuk akal.
ALTER TABLE public.weight_records DROP CONSTRAINT IF EXISTS weight_positive;
ALTER TABLE public.weight_records ADD CONSTRAINT weight_positive CHECK (weight_kg > 0);

ALTER TABLE public.mortality_records DROP CONSTRAINT IF EXISTS mortality_count_positive;
ALTER TABLE public.mortality_records ADD CONSTRAINT mortality_count_positive CHECK (count > 0);

ALTER TABLE public.batch_events DROP CONSTRAINT IF EXISTS batch_event_delta_nonzero;
ALTER TABLE public.batch_events ADD CONSTRAINT batch_event_delta_nonzero CHECK (delta <> 0);

ALTER TABLE public.livestock_batches DROP CONSTRAINT IF EXISTS batch_initial_count_positive;
ALTER TABLE public.livestock_batches ADD CONSTRAINT batch_initial_count_positive CHECK (initial_count > 0);

-- Populasi batch dihitung, bukan disimpan.
-- security_invoker: view memakai hak dan RLS pemanggil, bukan pemilik view.
DROP VIEW IF EXISTS public.batch_population;
CREATE VIEW public.batch_population WITH (security_invoker = true) AS
SELECT
  b.organization_id,
  b.id AS batch_id,
  b.initial_count
    + COALESCE((SELECT SUM(e.delta) FROM public.batch_events e WHERE e.batch_id = b.id), 0)
    - COALESCE((SELECT SUM(m.count) FROM public.mortality_records m
                WHERE m.batch_id = b.id AND m.voided_at IS NULL), 0) AS current_count
FROM public.livestock_batches b;

GRANT SELECT ON public.batch_population TO app_user;

-- Pengaman kedua: populasi batch tidak boleh negatif.
-- Baris batch dikunci agar dua transaksi bersamaan diperiksa berurutan.
CREATE OR REPLACE FUNCTION public.check_batch_population_nonneg() RETURNS trigger
LANGUAGE plpgsql AS
$$
DECLARE
  cnt bigint;
BEGIN
  IF NEW.batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.livestock_batches WHERE id = NEW.batch_id FOR UPDATE;

  SELECT current_count INTO cnt FROM public.batch_population WHERE batch_id = NEW.batch_id;

  IF cnt IS NOT NULL AND cnt < 0 THEN
    RAISE EXCEPTION 'Populasi batch tidak boleh negatif (batch %).', NEW.batch_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS mortality_population_check ON public.mortality_records;
CREATE TRIGGER mortality_population_check
  AFTER INSERT OR UPDATE OF count, batch_id, voided_at ON public.mortality_records
  FOR EACH ROW EXECUTE FUNCTION public.check_batch_population_nonneg();

DROP TRIGGER IF EXISTS batch_event_population_check ON public.batch_events;
CREATE TRIGGER batch_event_population_check
  AFTER INSERT ON public.batch_events
  FOR EACH ROW EXECUTE FUNCTION public.check_batch_population_nonneg();
