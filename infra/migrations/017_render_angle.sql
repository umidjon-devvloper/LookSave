-- 017_render_angle.sql
-- Kiyintirilgan natijani aylantirish: har burchak uchun alohida natija.
--
-- NEGA: sinovda aniqlandiki kiyintirish modeli YON KO'RINISHDA HAM
-- ishlaydi — poza tanildi, kiyim joylandi, yuz va gavda saqlandi. Ya'ni
-- foydalanuvchi kiyingan holda ham aylanib ko'ra oladi.
--
-- ⚠️ HAR BURCHAK ALOHIDA TO'LANADI. Bitta kiyimni uch burchakda ko'rish
-- uch kredit turadi. Shuning uchun ular oldindan yasalmaydi — foydalanuvchi
-- aylantirganda kerakli burchak so'raladi.
--
-- Migratsiya orqaga qaytmaydi. O'zgarish kerak bo'lsa — yangi raqamlangan fayl.

/*
 * Qaysi burchak uchun yasalgani.
 *
 * ⚠️ KESH KALITIGA KIRADI. `source_hash` ichida model surati bor va u
 * burchaklarda har xil, ya'ni texnik jihatdan ular allaqachon ajralib
 * turadi. Lekin alohida ustun bo'lmasa RO'YXATNI burchak bo'yicha filtrlab
 * bo'lmasdi: `DISTINCT ON (variant_id)` tasodifiy burchakni qaytarardi va
 * gallereyada old ko'rinish o'rniga yon ko'rinish chiqib qolardi.
 */
ALTER TABLE tryon_renders ADD COLUMN angle TEXT NOT NULL DEFAULT 'front'
  CHECK (angle IN ('front','side','back'));

-- Eski kesh kaliti burchakni bilmaydi — uni almashtiramiz.
DROP INDEX IF EXISTS tryon_renders_key_idx;

CREATE UNIQUE INDEX tryon_renders_key_idx
  ON tryon_renders (user_id, variant_id, angle, source_hash);

-- Gallereya so'rovi: bitta foydalanuvchi + bitta burchak bo'yicha.
DROP INDEX IF EXISTS tryon_renders_user_idx;

CREATE INDEX tryon_renders_user_idx
  ON tryon_renders (user_id, angle, status);

COMMENT ON COLUMN tryon_renders.angle IS
  'Ko''rish burchagi. Har biri alohida natija va alohida to''lov.';
