-- 2026-11-21 — App Store 4.3(b)/5.2.1 uchun: hamkor bo'lmagan brendlarni
-- katalogdan olib tashlash.
--
-- Sabab: /v1/brands endpointida ruxsatsiz brendlar (Nike, Adidas, Zara,
-- Puma, New Balance) turibdi. Mobil ilova bosh sahifada ularning logolari
-- bilan birga ko'rsatadi. Bu 5.2.1 (brend egasining ruxsati shart) va
-- 4.3(b) uchun aniq signal.
--
-- Darvoza 2026-09-09 da olib tashlangan (v1.ts): ilgari `is_partner=false`
-- bo'lsa logo yashirilardi, endi hamma logolar ko'rinadi. Endi brendlar
-- jadvalidan to'liq olib tashlanadi.
--
-- 1-qadam: mahsulotlardagi `brand_id` link'ini uzish (NULL qilish).
-- 2-qadam: `brands` jadvalidan o'chirish.
--
-- Ishga tushirish (VPS'da, prod .env bilan):
--   cd /var/www/looksave/apps/api
--   psql "$DATABASE_URL" -f scripts/sql/2026-11-21-non-partner-brands.sql

BEGIN;

-- 1. Qaysi brendlar ta'sirlanishi
\echo '--- Olib tashlanadigan brendlar ---'
SELECT id, name, slug, is_partner
FROM brands
WHERE slug IN ('nike', 'adidas', 'zara', 'puma', 'new-balance')
   OR (is_partner = false AND slug NOT IN ('luxury'));

-- 2. Qaysi mahsulotlar bu brendlarga bog'langan
\echo '--- Ta''sirlanadigan mahsulotlar soni ---'
SELECT b.slug, COUNT(p.id) AS products
FROM brands b
LEFT JOIN products p ON p.brand_id = b.id
WHERE b.slug IN ('nike', 'adidas', 'zara', 'puma', 'new-balance')
GROUP BY b.slug;

-- 3. Mahsulotlardagi link'ni uzish
UPDATE products
SET brand_id = NULL,
    updated_at = NOW()
WHERE brand_id IN (
  SELECT id FROM brands
  WHERE slug IN ('nike', 'adidas', 'zara', 'puma', 'new-balance')
);

-- 4. Brendlarni o'chirish
DELETE FROM brands
WHERE slug IN ('nike', 'adidas', 'zara', 'puma', 'new-balance');

\echo '--- Qolgan brendlar ---'
SELECT id, name, slug, is_partner FROM brands ORDER BY sort_order, name;

COMMIT;
