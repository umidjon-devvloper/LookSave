-- 037_stores_nationwide.sql
-- «Respublika bo'ylab» bayrog'i — do'kon mijozning joylashuviga qarab
-- yaqin bo'lmasa ham qidiruv ro'yxatida chiqadi.
--
-- MUAMMO: `/stores/nearby` `ST_DWithin` bilan radius ichidagi do'konlarni
-- ko'rsatadi. Toshkentdagi do'kon Samarqanddagi mijozga ko'rinmaydi.
-- Ko'pchilik do'kon shunday lokal — bu to'g'ri. Lekin ba'zilari
-- (pochta/kuryer orqali yetkazadigan) butun mamlakatga xizmat qiladi.
--
-- `nationwide = true` bo'lgan do'kon radiusdan qat'iy nazar ro'yxatga
-- qo'shiladi. `delivery_radius_m` (lokal yetkazish radiusi) o'zgarmaydi —
-- u hamon faqat buyurtmaga xizmat qiladi.

ALTER TABLE stores
  ADD COLUMN nationwide BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN stores.nationwide IS
  'TRUE bo''lsa do''kon /stores/nearby javobida mijozning joylashuvi qanchalik uzoq bo''lishidan qat''iy nazar chiqadi. Lokal dastavka radiusiga ta''sir qilmaydi.';

-- Qisman indeks: faqat yoqilgan do'konlarni belgilaydi. Katta jadvalda
-- `stores.status = 'active' AND nationwide` filtri indeksdan foydalanadi.
CREATE INDEX stores_nationwide_idx ON stores (status) WHERE nationwide;
