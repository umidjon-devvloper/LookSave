-- 020_anonymize_images.sql
--
-- Akkaunt anonimlashtirilganda SHAXSIY SURATLARNI ham tozalash.
--
-- ⚠️ NEGA KERAK (12-tz.md D-42). 012 dagi funksiya `face_texture_url` ni
-- tozalardi, lekin foydalanuvchining qiyofasi yana OLTI joyda qolardi:
--
--   users.avatar_url            — profil surati. Yuz skaneri AYNAN SHU
--                                 suratni ikkala maydonga yozadi, ya'ni
--                                 yuz surati baribir joyida qolardi
--   profiles.avatar_image_url   — AI yasagan to'liq bo'yli avatar
--   profiles.avatar_cutout_url  — uning fonsiz varianti
--   profiles.avatar_angles      — burchaklar bo'yicha suratlar (jsonb)
--   profiles.body_photo_url     — foydalanuvchi yuklagan to'liq bo'yli surat
--   tryon_renders.result_url    — kiyintirilgan suratlar. Bularda odam
--   tryon_renders.cutout_url      qiyofasi bevosita ko'rinadi
--
-- Ya'ni "akkauntni o'chirdim" degan foydalanuvchining yuzi tizimda
-- qolaverardi. App Store talabi ham, oddiy halollik ham buni ko'tarmaydi.
--
-- ⚠️ BU FUNKSIYA FAQAT BAZANI TOZALAYDI. Fayllarning o'zi R2 da — ularni
-- `auth/deletion.ts` o'chiradi: manzillar shu funksiya chaqirilishidan
-- OLDIN o'qib olinadi, chunki keyin ular yo'qoladi.

CREATE OR REPLACE FUNCTION anonymize_due_accounts(grace_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  affected INT;
BEGIN
  WITH due AS (
    SELECT id FROM users
     WHERE deletion_requested_at IS NOT NULL
       AND anonymized_at IS NULL
       AND deletion_requested_at < now() - make_interval(days => grace_days)
     FOR UPDATE SKIP LOCKED
  ),
  -- Profil: o'lchamlar, yuz teksturasi va BARCHA yasalgan suratlar
  cleared_profiles AS (
    UPDATE profiles p
       SET measurements      = '{}'::jsonb,
           morph_targets     = '{}'::jsonb,
           face_texture_url  = NULL,
           face_scan_status  = 'none',
           avatar_image_url  = NULL,
           avatar_cutout_url = NULL,
           avatar_angles     = '{}'::jsonb,
           avatar_status     = 'none',
           avatar_job_id     = NULL,
           avatar_error      = NULL,
           avatar_source_hash = NULL,
           angle_job_id      = NULL,
           angle_pending     = NULL,
           body_photo_url    = NULL
      FROM due WHERE p.user_id = due.id
    RETURNING p.user_id
  ),
  -- Kiyintirilgan suratlar — ularda odam qiyofasi bevosita ko'rinadi.
  -- Qator butunlay o'chadi: u kesh yozuvi, saqlashning ma'nosi yo'q.
  cleared_renders AS (
    DELETE FROM tryon_renders r USING due WHERE r.user_id = due.id
    RETURNING r.user_id
  ),
  -- Tasdiqlangan raqamlar butunlay o'chadi: ular faqat aloqa uchun
  cleared_phones AS (
    DELETE FROM verified_phones vp USING due WHERE vp.user_id = due.id
    RETURNING vp.user_id
  ),
  -- Qurilmalar va push tokenlari
  cleared_devices AS (
    DELETE FROM devices d USING due WHERE d.user_id = due.id
    RETURNING d.user_id
  ),
  -- Saqlangan komplektlar va sevimlilar shaxsiy ma'lumot
  cleared_looks AS (
    DELETE FROM looks l USING due WHERE l.user_id = due.id
    RETURNING l.user_id
  ),
  cleared_favorites AS (
    DELETE FROM favorites f USING due WHERE f.user_id = due.id
    RETURNING f.user_id
  )
  UPDATE users u
     SET phone         = 'deleted:' || u.id,
         email         = NULL,
         password_hash = NULL,
         full_name     = NULL,
         gender        = NULL,
         country       = NULL,
         -- ⚠️ 020 da qo'shildi: yuz skaneri suratni SHU maydonga ham
         -- yozadi, tozalanmasa yuz surati qolib ketardi
         avatar_url    = NULL,
         is_active     = false,
         anonymized_at = now()
    FROM due
   WHERE u.id = due.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION anonymize_due_accounts IS
  'Muddati o''tgan o''chirish so''rovlarini bajaradi: shaxsiy ma''lumot va '
  'BARCHA suratlar (profil, yuz, AI avatar, kiyintirish natijalari) tozalanadi. '
  'R2 dagi fayllarni auth/deletion.ts o''chiradi — manzillar shundan oldin o''qiladi.';
