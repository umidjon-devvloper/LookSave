-- 2026-11-21 (tuzatildi 2026-11-24) — sarlavha, tavsif va teglardan begona
-- brend nomlarini olib tashlash: Hermes / Hermès, Loro Piana, Louis Vuitton.
--
-- ⚠️ 2026-11-24 TUZATISHI: birinchi versiyadagi `'Hermès?\s+'` qoidasi «Herm»
-- + ixtiyoriy «è» ni qidirardi, ya'ni oddiy «Hermes» ga HECH QACHON mos
-- kelmasdi — skript ishlagan bo'lsa ham jonli katalogda 46 ta sarlavhada
-- «Hermes» qolgan edi. Endi so'z chegarasi bilan (`\m…\M`), ikkala yozuv
-- (`herm[eè]s`), katta-kichik harfdan qat'i nazar.
--
-- Natija: «Krasovka Hermes Bouncing №23» → «Krasovka Bouncing №23»,
-- «Kepka Hermes — ko'k» → «Kepka — ko'k». Qo'sh bo'shliqlar yig'iladi.
-- `search_vec` GENERATED ustun — o'zi yangilanadi.
--
-- Hamma do'konga qo'llanadi (faqat luxury emas): to'xtatilgan do'kon qayta
-- yoqilsa ham brend nomi qaytib chiqmasin. Buyurtma tarixiga tegilmaydi.
--
-- Qaytarish: ishga tushirishdan oldin `id, title, description, tags` CSV
-- zaxirasi olinadi (README), qaytarish — o'sha CSV'dan UPDATE.

BEGIN;

\echo '--- Oldin: brend nomi bor qatorlar ---'
SELECT
  count(*) FILTER (WHERE title ~* '\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M')       AS sarlavha,
  count(*) FILTER (WHERE description ~* '\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M') AS tavsif,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM unnest(tags) t WHERE t ~* '\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M'
  ))                                                                                    AS teg
FROM products;

UPDATE products
SET title = btrim(regexp_replace(
              regexp_replace(title, '\s*\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M', '', 'gi'),
              '\s{2,}', ' ', 'g')),
    updated_at = now()
WHERE title ~* '\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M';

UPDATE products
SET description = btrim(regexp_replace(
                    regexp_replace(description, '\s*\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M', '', 'gi'),
                    '\s{2,}', ' ', 'g')),
    updated_at = now()
WHERE description ~* '\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M';

UPDATE products
SET tags = ARRAY(
      SELECT t FROM unnest(tags) t
       WHERE t !~* '\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M'
    ),
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM unnest(tags) t WHERE t ~* '\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M'
);

\echo '--- Keyin: qolgan qatorlar (hammasi 0 bo''lishi kerak) ---'
SELECT
  count(*) FILTER (WHERE title ~* '\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M')       AS sarlavha,
  count(*) FILTER (WHERE description ~* '\m(herm[eè]s|loro\s+piana|louis\s+vuitton)\M') AS tavsif,
  count(*) FILTER (WHERE title = '')                                                    AS bosh_sarlavha
FROM products;

COMMIT;
