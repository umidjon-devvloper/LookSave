-- 039_favorite_alerts.sql
-- «Narx tushsa xabar» — sevimlidagi mahsulot arzonlashsa yoki yana sotuvga
-- chiqsa, foydalanuvchiga push boradi.
--
-- ⚠️ HOLAT SEVIMLI QATORIDA SAQLANADI, hodisa jadvali yo'q. Narx bir
-- nechta yo'ldan o'zgaradi (sotuvchi paneli, kengaytma, admin, SQL
-- skriptlar) — har biriga trigger/hook qo'yish o'rniga rejalashtiruvchi
-- (`jobs/scheduler.ts` → `checkFavoriteAlerts`) joriy holatni
-- `seen_*` bilan solishtiradi. Qaysi yo'l bilan o'zgarganining farqi yo'q.
--
-- ⚠️ SUKUT BO'YICHA O'CHIQ (`users.price_alerts = false`). App Store
-- 4.5.4: savdoga undovchi push faqat foydalanuvchi ilovada aniq rozilik
-- bergandan keyin va ilovaning o'zida o'chirish imkoni bilan yuboriladi.
-- Rozilik — sevimlilar sahifasidagi kalit.

-- Ilova «sotuvda bor» deb ko'rsatadigan shart bilan bir xil
-- (`catalog/products.ts` → available_sizes: faol variant, stock > reserved).
CREATE OR REPLACE FUNCTION product_in_stock(pid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM product_variants v
      JOIN variant_stock vs ON vs.variant_id = v.id
     WHERE v.product_id = pid AND v.is_active AND vs.stock > vs.reserved
  )
$$;

ALTER TABLE favorites
  -- Foydalanuvchi «biladigan» narx: sevimliga qo'shilgandagi yoki oxirgi
  -- xabardagi. Faqat xabar yuborilganda pasayadi, hech qachon ko'tarilmaydi —
  -- ya'ni xabar «saqlaganingizdan arzonroq» bo'lgandagina boradi.
  ADD COLUMN seen_price    NUMERIC(12,2),
  -- Oxirgi tekshiruvdagi mavjudlik: false → true bo'lsa «yana sotuvda».
  ADD COLUMN seen_in_stock BOOLEAN,
  -- Bitta mahsulot bo'yicha kuniga ko'pi bilan bitta xabar.
  ADD COLUMN alerted_at    TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN price_alerts BOOLEAN NOT NULL DEFAULT false;

-- Mavjud sevimlilar uchun boshlang'ich holat — aks holda birinchi
-- tekshiruv eski narxlar bilan solishtirib, ommaviy xabar yuborardi.
UPDATE favorites f
   SET seen_price = p.base_price,
       seen_in_stock = product_in_stock(p.id)
  FROM products p
 WHERE p.id = f.product_id;

COMMENT ON COLUMN users.price_alerts IS
  'Sevimlilar uchun narx tushishi / yana sotuvda xabarlari. Sukut o''chiq — rozilik ilovada.';
