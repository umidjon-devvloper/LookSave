-- 2026-11-21 — App Store 5.2.1 (va 4.3(b)) uchun: mahsulot tavsiflaridan
-- KONTRAFAKT (counterfeit) signallarini olib tashlash.
--
-- JONLI API'DA TOPILDI (2026-11-21):
--   «Premium barsetka. Lyuks kopiya.»
--   «Loro Piana Open Walk uslubidagi krasovka. Premium kopiya.»
--   «Hermes Bouncing uslubidagi krasovka. Premium kopiya.»
--
-- «Kopiya» (nusxa), «uslubidagi» (style/replica) va brend nomlari — bu
-- kontrafakt uchun eng aniq matniy signal. App Review bunday matnni
-- ko'rsa darhol 5.2.1 (tovar belgisi egasining ruxsati) bilan rad etadi.
--
-- Ishga tushirish (VPS'da, prod .env bilan):
--   cd /var/www/looksave/apps/api
--   psql "$DATABASE_URL" -f scripts/sql/2026-11-21-description-sanitize.sql

BEGIN;

-- 1. Hozirgi shubhali tavsiflar
\echo '--- Tozalanadigan tavsiflar namunalari ---'
SELECT DISTINCT description
FROM products
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND (description ~* '\mkopi(ya|yam)\M' OR description ~* '\muslubidagi\M'
       OR description ~* 'Herm[eè]s' OR description ~* 'Loro\s+Piana'
       OR description ~* 'Louis\s+Vuitton');

-- 2. Tozalash — ketma-ket regex REPLACE
UPDATE products
SET
  description = trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            -- (a) «<Brend> <modeli> uslubidagi» → bo'sh
            regexp_replace(description,
              '(Herm[eè]s|Loro\s+Piana|Louis\s+Vuitton)(\s+\S+)*\s+uslubidagi\s+',
              '', 'gi'),
            -- (b) «Premium/Lyuks/Standart/Oddiy kopiya» → bo'sh
            '(Premium|Lyuks|Standart|Oddiy|1:1|AAA)?\s*kopi(ya|yam)\s*\.?', '', 'gi'),
          -- (c) brend nomi alohida qolgan bo'lsa ham tozalash
          '(Herm[eè]s|Loro\s+Piana|Louis\s+Vuitton)\s*', '', 'gi'),
        -- (d) bo'sh ikki nuqtani birga
        '\.\s*\.', '.', 'g'),
      -- (e) bir nechta bo'shliqlarni bittaga
      '\s+', ' ', 'g'),
    -- (f) bosh harfga o'tkazish uchun jumla boshidagi kichik harfni
    '^([a-zа-яё])', upper('\1'), '')
  ),
  updated_at = NOW()
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND (description ~* '\mkopi(ya|yam)\M' OR description ~* '\muslubidagi\M'
       OR description ~* 'Herm[eè]s' OR description ~* 'Loro\s+Piana'
       OR description ~* 'Louis\s+Vuitton');

-- 3. Tekshirish — endi tavsiflar
\echo '--- Tozalangandan keyin ---'
SELECT DISTINCT description FROM products
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND updated_at >= NOW() - INTERVAL '1 minute';

\echo '--- Shubhali so''zlar qoldimi? (0 bo''lishi kerak) ---'
SELECT COUNT(*) FROM products
WHERE store_id = '9a598e34-52c7-4ad7-88a7-12faf4b04d44'
  AND (description ~* '\mkopi(ya|yam)\M' OR description ~* '\muslubidagi\M'
       OR description ~* 'Herm[eè]s' OR description ~* 'Loro\s+Piana'
       OR description ~* 'Louis\s+Vuitton');

COMMIT;
