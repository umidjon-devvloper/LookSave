-- TOP BRANDS uchun haqiqiy logolar.
-- R2 ga yuklangan PNG fayllar URL'ini quyidagi joylarga qo'ying,
-- keyin VPS'da ishga tushiring (quyida).
--
-- Yuklash yo'li:
--   Cloudflare R2 → bucket → brands/<slug>.png (public)
--   Public URL: https://pub-<id>.r2.dev/brands/<slug>.png

UPDATE brands SET logo_url = 'TODO_NIKE_URL'   WHERE slug = 'nike';
UPDATE brands SET logo_url = 'TODO_ADIDAS_URL' WHERE slug = 'adidas';
UPDATE brands SET logo_url = 'TODO_ZARA_URL'   WHERE slug = 'zara';
UPDATE brands SET logo_url = 'TODO_PUMA_URL'   WHERE slug = 'puma';
