-- 016_avatar_angles.sql
-- Avatarni aylantirib ko'rish: bir necha burchakdan surat.
--
-- NEGA KERAK: mijoz maketida "Rotate" tugmasi bor va foydalanuvchi o'zini
-- yon tomondan ko'rishni kutadi. Haqiqiy 3D o'rniga AI'dan bir xil yuz va
-- bir xil `seed` bilan turli burchakdan surat yasatiladi — ular orasida
-- almashtirilganda aylantirish taassuroti chiqadi.
--
-- ⚠️ HAR BURCHAK ALOHIDA KREDIT. Shuning uchun ular OLDINDAN yasalmaydi:
-- foydalanuvchi "aylantirish" tugmasini bosganda kerakli burchak
-- so'raladi va shu yerga yoziladi. Keyingi safar bepul keladi.
--
-- Migratsiya orqaga qaytmaydi. O'zgarish kerak bo'lsa — yangi raqamlangan fayl.

/*
 * Burchak -> surat manzili.
 *
 *   { "front": "https://cdn/…", "side": "https://cdn/…", "back": "…" }
 *
 * ⚠️ ALOHIDA JADVAL EMAS: burchaklar soni uchtadan oshmaydi va ular har
 * doim profil bilan birga o'qiladi. Jadval qilinsa har o'qishda qo'shimcha
 * JOIN kerak bo'lardi, foydasi esa yo'q.
 *
 * `front` bu yerda ham saqlanadi, garchi u `avatar_image_url` da bo'lsa
 * ham — shunda ilova hamma burchakni bitta joydan oladi va "qaysi biri
 * qayerda" degan savol tug'ilmaydi.
 */
ALTER TABLE profiles ADD COLUMN avatar_angles JSONB NOT NULL DEFAULT '{}';

/*
 * Ketayotgan burchak ishi.
 *
 * ⚠️ ASOSIY `avatar_job_id` DAN ALOHIDA: foydalanuvchi asosiy avatar
 * yasalayotganda ham burchak so'rashi mumkin emas, lekin burchak ishi
 * ketayotganda asosiy holat `ready` bo'lib qolishi kerak — aks holda
 * ekran "avatar yasalmoqda" ga qaytib ketardi.
 */
ALTER TABLE profiles ADD COLUMN angle_job_id TEXT;
ALTER TABLE profiles ADD COLUMN angle_pending TEXT
  CHECK (angle_pending IS NULL OR angle_pending IN ('front','side','back'));
ALTER TABLE profiles ADD COLUMN angle_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.avatar_angles IS
  'Burchak -> surat manzili. Talab bo''yicha to''ldiriladi, har biri bir marta to''lanadi.';

-- Tashlab ketilgan burchak ishlarini topish uchun.
CREATE INDEX profiles_angle_pending_idx
  ON profiles (angle_updated_at)
  WHERE angle_job_id IS NOT NULL;
