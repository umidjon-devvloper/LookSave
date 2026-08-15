-- 002_users.sql
-- Foydalanuvchilar, profil, tasdiqlangan raqamlar, OTP, ishonch balli, qurilmalar.
-- docs/02-database.md §3

-- ============================================================
-- FOYDALANUVCHILAR
-- ============================================================

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT UNIQUE NOT NULL,
  email          TEXT UNIQUE,
  password_hash  TEXT,
  full_name      TEXT,
  gender         TEXT CHECK (gender IN ('male','female')),
  role           TEXT NOT NULL DEFAULT 'customer'
                 CHECK (role IN ('customer','store_owner','admin')),
  locale         TEXT NOT NULL DEFAULT 'uz'
                 CHECK (locale IN ('uz','ru','en','ar')),
  country        TEXT CHECK (country IN ('UZ','AE')),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ
);

CREATE INDEX users_role_idx    ON users (role) WHERE is_active;
CREATE INDEX users_active_idx  ON users (last_active_at DESC NULLS LAST);


-- ============================================================
-- PROFIL: o'lchamlar va avatar
-- ============================================================

CREATE TABLE profiles (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- { height:180, weight:82, chest:98, waist:84, hips:96,
  --   shoeSize:42, shoeSizeSystem:"EU" }
  measurements     JSONB NOT NULL DEFAULT '{}',

  -- { height:0.62, weight:0.48, shoulderWidth:0.55,
  --   waist:0.40, chest:0.51, hips:0.44 }   — har biri 0.0–1.0
  morph_targets    JSONB NOT NULL DEFAULT '{}',

  face_texture_url TEXT,
  face_scan_status TEXT NOT NULL DEFAULT 'none'
                   CHECK (face_scan_status IN ('none','processing','ready','failed')),
  avatar_preset    TEXT NOT NULL DEFAULT 'default',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bo'y bo'yicha statistika uchun (analitika)
CREATE INDEX profiles_measurements_idx ON profiles USING GIN (measurements);


-- ============================================================
-- TASDIQLANGAN TELEFON RAQAMLARI
-- Buyurtma FAQAT shu jadvaldagi raqamdan beriladi.
-- Soxta buyurtmaga qarshi asosiy himoya (K-15).
-- ============================================================

CREATE TABLE verified_phones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,             -- E.164: +998901234567
  country     TEXT NOT NULL CHECK (country IN ('UZ','AE')),
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);

CREATE INDEX verified_phones_phone_idx ON verified_phones (phone);

-- Bir foydalanuvchida faqat bitta asosiy raqam
CREATE UNIQUE INDEX verified_phones_primary_idx
  ON verified_phones (user_id) WHERE is_primary;


-- ============================================================
-- OTP KODLARI
-- ============================================================

CREATE TABLE otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,             -- kod ochiq saqlanmaydi
  purpose     TEXT NOT NULL CHECK (purpose IN ('login','add_phone')),
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX otp_phone_idx   ON otp_codes (phone, created_at DESC);
CREATE INDEX otp_cleanup_idx ON otp_codes (expires_at);


-- ============================================================
-- ISHONCH BALLI (soxta buyurtmaga qarshi 4-qatlam)
-- ============================================================

CREATE TABLE user_trust (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  orders_total     INT NOT NULL DEFAULT 0,
  orders_completed INT NOT NULL DEFAULT 0,
  orders_cancelled INT NOT NULL DEFAULT 0,
  orders_expired   INT NOT NULL DEFAULT 0,
  orders_noshow    INT NOT NULL DEFAULT 0,   -- sotuvchi "kelmadi" dedi
  is_restricted    BOOLEAN NOT NULL DEFAULT false,
  restricted_until TIMESTAMPTZ,
  restriction_note TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_trust_restricted_idx
  ON user_trust (restricted_until) WHERE is_restricted;


-- ============================================================
-- QURILMALAR (push token + bir qurilmadan ≤2 akkaunt cheklovi)
-- ============================================================

CREATE TABLE devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id     TEXT NOT NULL,           -- qurilma fingerprint
  platform      TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  push_token    TEXT,
  app_version   TEXT,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX devices_device_idx ON devices (device_id);
CREATE INDEX devices_push_idx   ON devices (push_token) WHERE push_token IS NOT NULL;
