-- 009_phase7.sql : Harga pasar. Aman dijalankan berulang.
ALTER TABLE public.market_prices DROP CONSTRAINT IF EXISTS market_price_positive;
ALTER TABLE public.market_prices ADD CONSTRAINT market_price_positive CHECK (price > 0);
