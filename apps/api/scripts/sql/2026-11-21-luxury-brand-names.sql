-- 2026-11-21 — App Store 4.3(b) uchun: luxury do'kon sarlavhalaridan
-- brend nomlarini olib tashlash. Mahsulot, rasm, do'kon TEGILMAYDI —
-- faqat `title` matni tozalanadi.
--
-- Reviewer sotayotgan mahsulotlarda «Hermès», «Loro Piana», «Louis Vuitton»
-- so'zlarini va «100% original» da'vosini birga ko'rib shubha qilgan.
-- «100% original» avval olib tashlangan (edff4f8). Endi brend so'zlari.
--
-- Ishga tushirish (VPS'da, prod .env bilan):
--   cd /var/www/looksave/apps/api
--   psql "$DATABASE_URL" -f scripts/sql/2026-11-21-luxury-brand-names.sql
--   # yoki ichidan:  pm2 restart ecosystem.config.js --only api  (shart emas)

BEGIN;

-- 1. Dry preview — qanday o'zgarishi
\echo '--- O''zgarishlar ro''yxati ---'
SELECT
  id,
  title AS old_title,
  regexp_replace(
    regexp_replace(
      regexp_replace(title, 'Hermès?\s+', '', 'gi'),
      'Loro\s+Piana\s+', '', 'gi'
    ),
    'Louis\s+Vuitton\s+', '', 'gi'
  ) AS new_title
FROM products
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND (title ~* 'Hermès?' OR title ~* 'Loro\s+Piana' OR title ~* 'Louis\s+Vuitton')
ORDER BY title;

-- 2. Yangilash
UPDATE products
SET
  title = regexp_replace(
            regexp_replace(
              regexp_replace(title, 'Hermès?\s+', '', 'gi'),
              'Loro\s+Piana\s+', '', 'gi'
            ),
            'Louis\s+Vuitton\s+', '', 'gi'
          ),
  updated_at = NOW()
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND (title ~* 'Hermès?' OR title ~* 'Loro\s+Piana' OR title ~* 'Louis\s+Vuitton');

\echo '--- Tozalangan qatorlar soni ---'
SELECT COUNT(*) AS cleaned_rows
FROM products
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND updated_at >= NOW() - INTERVAL '1 minute';

COMMIT;
