-- 006_phase3.sql : constraint dan RLS khusus Marketplace (tabel lintas organisasi). Aman dijalankan berulang.
-- Konteks organisasi aktif = app_current_org(). Tidak ada tabel di sini yang bisa dibaca/ditulis tanpa konteks itu,
-- kecuali yang memang publik (profil vendor, listing terbit, ulasan).

ALTER TABLE public.market_listings DROP CONSTRAINT IF EXISTS listing_price_nonneg;
ALTER TABLE public.market_listings ADD CONSTRAINT listing_price_nonneg CHECK (price_idr >= 0);
ALTER TABLE public.market_listings DROP CONSTRAINT IF EXISTS listing_stock_nonneg;
ALTER TABLE public.market_listings ADD CONSTRAINT listing_stock_nonneg CHECK (stock >= 0);
ALTER TABLE public.market_orders DROP CONSTRAINT IF EXISTS order_qty_positive;
ALTER TABLE public.market_orders ADD CONSTRAINT order_qty_positive CHECK (quantity > 0);
ALTER TABLE public.market_orders DROP CONSTRAINT IF EXISTS order_not_self;
ALTER TABLE public.market_orders ADD CONSTRAINT order_not_self CHECK (buyer_org_id <> seller_org_id);
ALTER TABLE public.market_reviews DROP CONSTRAINT IF EXISTS review_rating_range;
ALTER TABLE public.market_reviews ADD CONSTRAINT review_rating_range CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE public.market_orders DROP CONSTRAINT IF EXISTS market_orders_listing_fk;
ALTER TABLE public.market_orders ADD CONSTRAINT market_orders_listing_fk
  FOREIGN KEY (listing_id) REFERENCES public.market_listings (id) ON DELETE RESTRICT;
ALTER TABLE public.market_reviews DROP CONSTRAINT IF EXISTS market_reviews_order_fk;
ALTER TABLE public.market_reviews ADD CONSTRAINT market_reviews_order_fk
  FOREIGN KEY (order_id) REFERENCES public.market_orders (id) ON DELETE RESTRICT;

-- vendor_profiles: dibaca semua, ditulis pemiliknya.
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_select ON public.vendor_profiles;
DROP POLICY IF EXISTS vendor_write ON public.vendor_profiles;
CREATE POLICY vendor_select ON public.vendor_profiles FOR SELECT USING (true);
CREATE POLICY vendor_write ON public.vendor_profiles FOR ALL
  USING (org_id = public.app_current_org()) WITH CHECK (org_id = public.app_current_org());

-- market_listings: yang terbit terlihat semua; sisanya hanya penjual.
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_listings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listing_select ON public.market_listings;
DROP POLICY IF EXISTS listing_write ON public.market_listings;
CREATE POLICY listing_select ON public.market_listings FOR SELECT
  USING (status = 'PUBLISHED' OR seller_org_id = public.app_current_org());
CREATE POLICY listing_write ON public.market_listings FOR ALL
  USING (seller_org_id = public.app_current_org()) WITH CHECK (seller_org_id = public.app_current_org());

-- market_orders: terlihat oleh pembeli dan penjual; dibuat oleh pembeli; diubah oleh keduanya.
ALTER TABLE public.market_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_select ON public.market_orders;
DROP POLICY IF EXISTS order_insert ON public.market_orders;
DROP POLICY IF EXISTS order_update ON public.market_orders;
CREATE POLICY order_select ON public.market_orders FOR SELECT
  USING (buyer_org_id = public.app_current_org() OR seller_org_id = public.app_current_org());
CREATE POLICY order_insert ON public.market_orders FOR INSERT
  WITH CHECK (buyer_org_id = public.app_current_org());
CREATE POLICY order_update ON public.market_orders FOR UPDATE
  USING (buyer_org_id = public.app_current_org() OR seller_org_id = public.app_current_org())
  WITH CHECK (buyer_org_id = public.app_current_org() OR seller_org_id = public.app_current_org());

-- market_reviews: publik dibaca; ditulis pembeli; tidak bisa diubah/dihapus.
ALTER TABLE public.market_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_reviews FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS review_select ON public.market_reviews;
DROP POLICY IF EXISTS review_insert ON public.market_reviews;
CREATE POLICY review_select ON public.market_reviews FOR SELECT USING (true);
CREATE POLICY review_insert ON public.market_reviews FOR INSERT WITH CHECK (buyer_org_id = public.app_current_org());
REVOKE UPDATE, DELETE, TRUNCATE ON public.market_reviews FROM app_user;
