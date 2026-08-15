-- 003_stores.sql
-- Brendlar, do'konlar (PostGIS), do'kon xodimlari.
-- docs/02-database.md §4

-- ============================================================
-- BRENDLAR
-- ============================================================

CREATE TABLE brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  description TEXT,
  is_partner  BOOLEAN NOT NULL DEFAULT false,  -- shartnoma bormi
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX brands_partner_idx ON brands (is_partner, sort_order);


-- ============================================================
-- DO'KONLAR
-- ============================================================

CREATE TABLE stores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES users(id),
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description       TEXT,
  logo_url          TEXT,
  cover_url         TEXT,

  -- PostGIS: GEOGRAPHY (GEOMETRY emas) — metrda masofa beradi
  location          GEOGRAPHY(POINT, 4326) NOT NULL,
  address           TEXT NOT NULL,
  landmark          TEXT,                     -- mo'ljal
  city              TEXT NOT NULL,
  country           TEXT NOT NULL CHECK (country IN ('UZ','AE')),

  phone             TEXT NOT NULL,
  telegram_chat_id  BIGINT,                   -- bot ulanganda to'ladi
  telegram_link_code TEXT UNIQUE,             -- botni ulash uchun bir martalik kod

  -- [{ day:1, open:"10:00", close:"22:00", closed:false }]  1=dushanba
  working_hours     JSONB NOT NULL DEFAULT '[]',

  delivery_enabled  BOOLEAN NOT NULL DEFAULT true,
  pickup_enabled    BOOLEAN NOT NULL DEFAULT true,
  delivery_radius_m INT NOT NULL DEFAULT 15000,
  delivery_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
  free_delivery_from NUMERIC(12,2),

  currency          TEXT NOT NULL DEFAULT 'UZS' CHECK (currency IN ('UZS','AED','USD')),
  commission_rate   NUMERIC(5,4) NOT NULL DEFAULT 0.0000,  -- Faza 1-2 da 0 (K-12)

  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','suspended','rejected')),
  reject_reason     TEXT,

  rating            NUMERIC(2,1) NOT NULL DEFAULT 0,
  review_count      INT NOT NULL DEFAULT 0,
  -- Javob tezligi (daqiqa) — cron hisoblaydi, qidiruv reytingiga ta'sir qiladi
  avg_response_min  INT,
  confirm_rate      NUMERIC(4,3),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ⭐ Eng muhim index: yaqin do'konlar qidiruvi shu bilan ishlaydi
CREATE INDEX stores_location_idx ON stores USING GIST (location);

CREATE INDEX stores_city_idx     ON stores (country, city, status);
CREATE INDEX stores_owner_idx    ON stores (owner_id);
CREATE INDEX stores_status_idx   ON stores (status) WHERE status = 'pending';
CREATE INDEX stores_name_trgm    ON stores USING GIN (name gin_trgm_ops);


-- ============================================================
-- DO'KON XODIMLARI (bitta do'konda bir necha kishi ishlashi mumkin)
-- ============================================================

CREATE TABLE store_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','manager','staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);
