-- 009_auth.sql
-- Parol bilan ro'yxatdan o'tish (Faza 1 vaqtincha yechimi).
--
-- ⚠️ MUHIM: 00-README K-15 ga ko'ra telefon OTP bilan bog'lanishi kerak edi.
-- Faza 1 da OTP yo'q, shuning uchun raqam "tasdiqlangan" deb belgilanadi,
-- lekin QANDAY tasdiqlangani yozib qo'yiladi. OTP qo'shilganda
-- `verified_via = 'password_signup'` bo'lgan raqamlarni topib qayta
-- tasdiqlatish mumkin — ma'lumot yo'qolmaydi.

ALTER TABLE verified_phones
  ADD COLUMN verified_via TEXT NOT NULL DEFAULT 'otp'
  CHECK (verified_via IN ('otp', 'password_signup', 'admin'));

COMMENT ON COLUMN verified_phones.verified_via IS
  'Raqam qanday tasdiqlangan. password_signup = OTP tekshiruvidan O''TMAGAN (Faza 1).';

-- Parol o'rnatilgan sanani bilish kerak (majburiy almashtirish, xavfsizlik auditi)
ALTER TABLE users
  ADD COLUMN password_set_at TIMESTAMPTZ;

-- Parol bilan kirish urinishlari — qo'pol kuch hujumini tekshirish uchun.
-- Asosiy cheklov Redis'da (tez), bu jadval tarix uchun (Redis o'chsa ham qoladi).
CREATE TABLE login_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL,
  ip         INET,
  success    BOOLEAN NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_phone_idx ON login_attempts (phone, created_at DESC);
CREATE INDEX login_attempts_cleanup_idx ON login_attempts (created_at);
