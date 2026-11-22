-- 018_listing_images.sql : foto produk marketplace. Aman dijalankan berulang.
-- Dilihat semua anggota bila produknya tayang (PUBLISHED); selain itu hanya penjual. Ditulis hanya penjual.
ALTER TABLE public.market_listing_images DROP CONSTRAINT IF EXISTS listing_image_listing_fk;
ALTER TABLE public.market_listing_images ADD CONSTRAINT listing_image_listing_fk
  FOREIGN KEY (listing_id) REFERENCES public.market_listings (id) ON DELETE CASCADE;
ALTER TABLE public.market_listing_images DROP CONSTRAINT IF EXISTS listing_image_size_range;
ALTER TABLE public.market_listing_images ADD CONSTRAINT listing_image_size_range CHECK (size_bytes BETWEEN 100 AND 716800);
ALTER TABLE public.market_listing_images DROP CONSTRAINT IF EXISTS listing_image_type_valid;
ALTER TABLE public.market_listing_images ADD CONSTRAINT listing_image_type_valid CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp'));

ALTER TABLE public.market_listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_listing_images FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listing_image_select ON public.market_listing_images;
DROP POLICY IF EXISTS listing_image_write ON public.market_listing_images;
CREATE POLICY listing_image_select ON public.market_listing_images FOR SELECT
  USING (seller_org_id = public.app_current_org()
         OR EXISTS (SELECT 1 FROM public.market_listings l WHERE l.id = listing_id AND l.status = 'PUBLISHED'));
CREATE POLICY listing_image_write ON public.market_listing_images FOR ALL
  USING (seller_org_id = public.app_current_org()) WITH CHECK (seller_org_id = public.app_current_org());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_listing_images TO app_user;
