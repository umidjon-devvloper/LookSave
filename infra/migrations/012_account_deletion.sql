-- ============================================================
-- 012 — Akkauntni o'chirish (App Store talabi)
--
-- 03-api-spec §5: 30 kunlik kutish, keyin anonimlashtirish.
-- Buyurtma tarixi do'kon uchun saqlanadi, shaxsiy ma'lumot o'chiriladi.
--
-- Nega darhol o'chirilmaydi:
--   1. Apple "akkauntni o'chirish" tugmasini talab qiladi, lekin darhol
--      o'chirishni talab qilmaydi — kutish muddati ruxsat etilgan
--   2. Do'konda ochiq buyurtma qolgan bo'lishi mumkin
--   3. Xato bosilgan tugmani qaytarish imkoni bo'lishi kerak
--
-- Nega qator o'chirilmaydi (DELETE emas, anonimlashtirish):
--   `orders.user_id` va `order_events` ga FK bor. Qator o'chirilsa
--   do'konning buyurtma tarixi buziladi — u yerda pul hisob-kitobi bor.
-- ============================================================

ALTER TABLE users
  ADD COLUMN deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN anonymized_at        TIMESTAMPTZ;

COMMENT ON COLUMN users.deletion_requested_at IS
  'Foydalanuvchi o''chirishni so''ragan vaqt. 30 kun ichida kirish bekor qiladi.';
COMMENT ON COLUMN users.anonymized_at IS
  'Shaxsiy ma''lumot o''chirilgan vaqt. To''ldirilgan bo''lsa qayta tiklab bo''lmaydi.';

-- Anonimlashtirish navbatini topish uchun. Qisman indeks: kutayotganlar
-- ozchilik, butun jadvalni indekslashning hojati yo'q.
CREATE INDEX users_deletion_idx
  ON users (deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL AND anonymized_at IS NULL;

-- ============================================================
-- Anonimlashtirish funksiyasi
--
-- Telefon raqami o'rniga barqaror, lekin qaytarib bo'lmaydigan qiymat
-- qo'yiladi: `deleted:<uuid>`. UNIQUE cheklovi buzilmaydi va bir xil
-- raqam bilan qayta ro'yxatdan o'tish mumkin bo'ladi.
--
-- `md5` yoki `sha256` ishlatilmaydi ataylab: telefon raqamlari maydoni
-- kichik (~10^9), hash'ni to'liq skanerlab qaytarib bo'ladi. Bu
-- anonimlashtirish emas, psevdonimlashtirish bo'lardi.
-- ============================================================

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
  -- Profil: o'lchamlar va yuz teksturasi — eng sezgir ma'lumot
  cleared_profiles AS (
    UPDATE profiles p
       SET measurements     = '{}'::jsonb,
           morph_targets    = '{}'::jsonb,
           face_texture_url = NULL,
           face_scan_status = 'none'
      FROM due WHERE p.user_id = due.id
    RETURNING p.user_id
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
         is_active     = false,
         anonymized_at = now()
    FROM due
   WHERE u.id = due.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION anonymize_due_accounts IS
  '30 kundan oshgan o''chirish so''rovlarini bajaradi. Rejalashtiruvchi kuniga bir marta chaqiradi.';
