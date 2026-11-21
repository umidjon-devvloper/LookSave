-- 2026-11-21 — App Store 4.3(b) uchun: «... — model N» suffixini tozalash.
--
-- Sabab: «model N» suffixi reviewerga dummy/placeholder/sinov ma'lumotidek
-- ko'rinadi (katalogni to'ldirish uchun generatsiya qilingan matn
-- taassurotini beradi). «Barsetka — model 23» → «Barsetka №23».
-- «Krasovka Bouncing — model 30» → «Krasovka Bouncing №30» (brend nomlari
-- avvalgi SQL bilan olib tashlangan).
--
-- MUHIM: `2026-11-21-luxury-brand-names.sql` DAN KEYIN ishga tushiriladi
-- (brend nomlari olib tashlanganidan keyin suffix tozalanadi).
--
-- Shu formatda qolgan boshqa mahsulotlar (masalan, «Barsetka — bej»,
-- «Barsetka — mono qora») toza — ular rang/materialni ko'rsatadi, u yerda
-- muammo yo'q.
--
-- Ishga tushirish (VPS'da, prod .env bilan):
--   cd /var/www/looksave/apps/api
--   psql "$DATABASE_URL" -f scripts/sql/2026-11-21-barsetka-model-rename.sql

BEGIN;

-- 1. Dry preview
\echo '--- O''zgarishlar ro''yxati ---'
SELECT
  id,
  title AS old_title,
  regexp_replace(title, '\s+—\s+model\s+(\d+)\s*$', ' №\1', 'i') AS new_title
FROM products
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND title ~* '\s+—\s+model\s+\d+\s*$'
ORDER BY title;

-- 2. Yangilash
UPDATE products
SET
  title = regexp_replace(title, '\s+—\s+model\s+(\d+)\s*$', ' №\1', 'i'),
  updated_at = NOW()
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND title ~* '\s+—\s+model\s+\d+\s*$';

\echo '--- Yangilangan qatorlar soni ---'
SELECT COUNT(*) FROM products
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND updated_at >= NOW() - INTERVAL '1 minute';

COMMIT;
