-- Do'kon jinsi (auditoriya) — Market'dagi «Erkaklar» / «Ayollar» bo'limlari.
--
-- MUAMMO: do'konlarda jins belgisi yo'q edi, shuning uchun Market'da
-- «Erkaklar» ham, «Ayollar» ham bir xil ro'yxatni ko'rsatardi (jins faqat
-- `products.gender` da edi, do'kon darajasida emas).
--
-- `both` = ikkala bo'limda ham chiqadi. Mavjud do'konlar `both` bo'lib
-- qoladi — hech biri ro'yxatdan yo'qolmaydi; sotuvchi keyin panelidan
-- o'zgartiradi. Do'kon ochish arizasida bu endi so'raladi.

ALTER TABLE stores
  ADD COLUMN audience TEXT NOT NULL DEFAULT 'both'
  CHECK (audience IN ('men', 'women', 'both'));

-- Market ro'yxati jins bo'yicha filtrlanadi: `WHERE audience = $x OR audience = 'both'`.
-- Ro'yxat `status = 'active'` bilan birga olinadi, shuning uchun birgalikda indeks.
CREATE INDEX stores_audience_idx ON stores (status, audience);
