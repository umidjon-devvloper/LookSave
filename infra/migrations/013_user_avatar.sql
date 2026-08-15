-- 013_user_avatar.sql
-- Foydalanuvchining o'z surati (profil ekrani).
--
-- NEGA `profiles` da EMAS: `profiles.face_texture_url` — bu 3D avatarga
-- yopishtiriladigan yuz teksturasi, ya'ni texnik ma'lumot. Bu yerdagi surat
-- esa oddiy profil rasmi va u autentifikatsiya javobida (`toAuthUser`)
-- qaytariladi, shuning uchun `users` jadvalida turadi.
--
-- Migratsiya orqaga qaytmaydi. O'zgarish kerak bo'lsa — yangi raqamlangan fayl.

ALTER TABLE users ADD COLUMN avatar_url TEXT;

COMMENT ON COLUMN users.avatar_url IS
  'Profil surati (R2 havolasi). NULL bo''lsa ilova ism bosh harflarini ko''rsatadi.';
