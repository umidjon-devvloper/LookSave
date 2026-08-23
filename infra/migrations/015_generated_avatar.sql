-- 015_generated_avatar.sql
-- AI yasagan to'liq bo'yli avatar: yuz surati + o'lchovlar -> odam surati.
--
-- NEGA KERAK: to'liq bo'yli suratga tushish hammaga ham qulay emas —
-- buning uchun joy, oyna va ko'pincha boshqa odamning yordami kerak.
-- Yuzni skaner qilish esa oddiy selfi. Qolgan gavda o'lchovlardan
-- generatsiya qilinadi.
--
-- ⚠️ MUHIM FARQ: yasalgan gavda foydalanuvchining HAQIQIY gavdasi emas,
-- balki o'lchovlariga yaqinlashtirilgan sintetik tasvir. O'lcham tavsiyasi
-- shu suratdan EMAS, `profiles.measurements` dagi haqiqiy raqamlardan
-- hisoblanadi — shuning uchun tavsiya aniqligi o'zgarmaydi.
--
-- Migratsiya orqaga qaytmaydi. O'zgarish kerak bo'lsa — yangi raqamlangan fayl.

ALTER TABLE profiles ADD COLUMN avatar_image_url TEXT;

ALTER TABLE profiles ADD COLUMN avatar_status TEXT NOT NULL DEFAULT 'none'
  CHECK (avatar_status IN ('none','processing','ready','failed'));

ALTER TABLE profiles ADD COLUMN avatar_job_id TEXT;
ALTER TABLE profiles ADD COLUMN avatar_error TEXT;

/*
 * Manba barmoq izi — sha256(yuz_surati + '|' + tavsif).
 *
 * ⚠️ TAVSIF HAM KIRADI. Faqat yuz manzili olinsa, foydalanuvchi bo'yini
 * yoki o'lchovlarini o'zgartirganda avatar eski gavda bilan qolib ketardi.
 * Tavsif o'lchovlardan tuziladi, ya'ni har qanday o'zgarish hashni
 * o'zgartiradi va avatar qaytadan yasaladi.
 */
ALTER TABLE profiles ADD COLUMN avatar_source_hash TEXT;

ALTER TABLE profiles ADD COLUMN avatar_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.avatar_image_url IS
  'AI yasagan to''liq bo''yli surat (R2). Kiyintirishda asos bo''lib ishlatiladi.';

COMMENT ON COLUMN profiles.avatar_source_hash IS
  'sha256(yuz surati + tavsif). O''zgarsa avatar qaytadan yasaladi.';

-- Osilib qolgan generatsiyalarni topish uchun (provayder javob bermay qolsa).
CREATE INDEX profiles_avatar_pending_idx
  ON profiles (avatar_status, avatar_updated_at)
  WHERE avatar_status = 'processing';
