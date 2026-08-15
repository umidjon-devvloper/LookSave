# 02 — Ma'lumotlar bazasi

**Baza:** PostgreSQL 16 + PostGIS 3.4
**Bog'liq:** [01-arxitektura.md](./01-arxitektura.md)

---

## 1. Umumiy qoidalar

| Qoida | Sabab |
|---|---|
| Jadval nomlari ko'plikda, `snake_case` | Standart |
| ID — `UUID v4`, `gen_random_uuid()` | Enumeratsiya hujumidan himoya, merge oson |
| Vaqt — `TIMESTAMPTZ`, doim UTC | Ikki mamlakat, ikki vaqt zonasi |
| Pul — `NUMERIC(12,2)`, hech qachon `float` | `float` da 0.1 + 0.2 ≠ 0.3 |
| O'chirish — `status` orqali (soft delete) | Buyurtma tarixi buzilmasligi kerak |
| Migratsiya — raqamlangan, orqaga qaytmaydi | Har o'zgarish yangi fayl |
| Har jadvalda `created_at` | Debug va analitika uchun |

### Migratsiya fayllari

```
infra/migrations/
├── 001_extensions.sql
├── 002_users.sql
├── 003_stores.sql
├── 004_catalog.sql
├── 005_orders.sql
├── 006_looks.sql
├── 007_functions.sql
└── 008_seed.sql
```

Ishga tushirish:

```bash
for f in infra/migrations/*.sql; do
  echo "→ $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

---

## 2. `001_extensions.sql`

```sql
-- PostGIS: geo-qidiruv (yaqin do'konlar)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Trigram: noaniq matn qidiruvi ("nayk" → "Nike")
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- gen_random_uuid() uchun (PG13+ da o'rnatilgan, lekin kafolat uchun)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Sekin so'rovlarni topish uchun
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

---

## 3. `002_users.sql`

```sql
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
```

---

## 4. `003_stores.sql`

```sql
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
```

---

## 5. `004_catalog.sql`

```sql
-- ============================================================
-- KATEGORIYALAR (daraxt + 3D slot bog'lanishi)
-- ============================================================

CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  UUID REFERENCES categories(id) ON DELETE CASCADE,
  slug       TEXT UNIQUE NOT NULL,
  -- { uz:"Ustki kiyim", ru:"Верхняя одежда", en:"Tops", ar:"..." }
  name       JSONB NOT NULL,
  icon       TEXT,
  slot       TEXT CHECK (slot IN ('head','face','neck','top','outer',
                                  'bottom','feet','wrist','bag')),
  gender     TEXT NOT NULL DEFAULT 'unisex'
             CHECK (gender IN ('male','female','unisex')),
  -- Bu kategoriyada qanday o'lcham tizimi ishlatiladi
  size_type  TEXT CHECK (size_type IN ('clothing','shoes','onesize')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX categories_parent_idx ON categories (parent_id, sort_order);
CREATE INDEX categories_slot_idx   ON categories (slot) WHERE is_active;


-- ============================================================
-- MAHSULOTLAR
-- ============================================================

CREATE TABLE products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  brand_id     UUID REFERENCES brands(id),
  category_id  UUID NOT NULL REFERENCES categories(id),

  title        TEXT NOT NULL,
  description  TEXT,
  slot         TEXT NOT NULL,          -- kategoriyadan ko'chiriladi (tez filtr uchun)
  gender       TEXT NOT NULL CHECK (gender IN ('male','female','unisex')),

  base_price   NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
  old_price    NUMERIC(12,2),          -- chegirma ko'rsatish uchun
  currency     TEXT NOT NULL,

  images       JSONB NOT NULL DEFAULT '[]',   -- ["https://cdn.../1.webp", ...]
  tags         TEXT[] NOT NULL DEFAULT '{}',
  is_limited   BOOLEAN NOT NULL DEFAULT false,
  has_3d       BOOLEAN NOT NULL DEFAULT false, -- tez filtr, trigger yangilaydi

  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','pending','active','archived','rejected')),

  view_count   INT NOT NULL DEFAULT 0,
  tryon_count  INT NOT NULL DEFAULT 0,
  order_count  INT NOT NULL DEFAULT 0,

  search_vec   tsvector GENERATED ALWAYS AS (
                 to_tsvector('simple',
                   coalesce(title,'') || ' ' || coalesce(description,''))
               ) STORED,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_store_idx    ON products (store_id, status, created_at DESC);
CREATE INDEX products_category_idx ON products (category_id, gender, status);
CREATE INDEX products_slot_idx     ON products (slot, gender, status) WHERE has_3d;
CREATE INDEX products_brand_idx    ON products (brand_id) WHERE status = 'active';
CREATE INDEX products_search_idx   ON products USING GIN (search_vec);
CREATE INDEX products_title_trgm   ON products USING GIN (title gin_trgm_ops);
CREATE INDEX products_tags_idx     ON products USING GIN (tags);
CREATE INDEX products_price_idx    ON products (base_price) WHERE status = 'active';


-- ============================================================
-- VARIANTLAR (rang)
-- ============================================================

CREATE TABLE product_variants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_hex   TEXT,                     -- "#1a1a1a"
  color_name  JSONB,                    -- { uz:"Qora", en:"Black" }
  images      JSONB NOT NULL DEFAULT '[]',
  price_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX variants_product_idx ON product_variants (product_id, sort_order)
  WHERE is_active;


-- ============================================================
-- OMBOR (variant × o'lcham)
-- ============================================================

CREATE TABLE variant_stock (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  size       TEXT NOT NULL,             -- "M" | "42" | "ONE"
  sku        TEXT UNIQUE,
  stock      INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved   INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  UNIQUE (variant_id, size)
);

CREATE INDEX stock_available_idx ON variant_stock (variant_id)
  WHERE stock > reserved;


-- ============================================================
-- 3D ASSETLAR
-- ============================================================

CREATE TABLE assets_3d (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id      UUID UNIQUE NOT NULL
                  REFERENCES product_variants(id) ON DELETE CASCADE,

  glb_url         TEXT,
  -- { lod0:"...", lod1:"...", lod2:"..." }
  lod_urls        JSONB NOT NULL DEFAULT '{}',
  thumbnail_url   TEXT,

  file_size_bytes INT,
  poly_count      INT,
  texture_size    INT,                  -- 512 | 1024 | 2048

  -- Kiyim ostidagi tana qismlari yashiriladi (Z-fighting oldini olish)
  hide_body_parts TEXT[] NOT NULL DEFAULT '{}',
  -- Blendshape'lar mavjudmi (tana o'lchami o'zgarganda kiyim ham o'zgaradi)
  has_morphs      BOOLEAN NOT NULL DEFAULT false,

  status          TEXT NOT NULL DEFAULT 'none'
                  CHECK (status IN ('none','queued','processing','ready','failed')),
  error_message   TEXT,
  -- QA natijasi: { fps_low_android:34, load_ms:640, ram_mb:280 }
  qa_result       JSONB,

  requested_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX assets_status_idx ON assets_3d (status, requested_at)
  WHERE status IN ('queued','processing');
```

---

## 6. `005_orders.sql`

```sql
-- ============================================================
-- SAVAT
-- ============================================================

CREATE TABLE carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  size       TEXT NOT NULL,
  qty        INT NOT NULL DEFAULT 1 CHECK (qty > 0 AND qty <= 10),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id, size)
);

CREATE INDEX cart_items_cart_idx ON cart_items (cart_id);


-- ============================================================
-- BUYURTMALAR — to'lov tizimisiz model (K-10)
-- Buyurtma = sotuvchiga yuboriladigan so'rov
-- ============================================================

CREATE TABLE order_counters (
  day     DATE PRIMARY KEY,
  counter INT NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT UNIQUE NOT NULL,        -- LS-260812-0043 (trigger to'ldiradi)
  user_id         UUID NOT NULL REFERENCES users(id),
  store_id        UUID NOT NULL REFERENCES stores(id),

  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','seen','confirmed','rejected',
                                    'ready','completed','cancelled','expired')),

  delivery_type   TEXT NOT NULL CHECK (delivery_type IN ('delivery','pickup')),

  contact_name    TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,               -- verified_phones da bo'lishi SHART
  -- delivery: { text, lat, lng, landmark }  — lat/lng MAJBURIY
  address         JSONB,
  note            TEXT,

  subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  currency        TEXT NOT NULL,

  -- Komissiya hisoblanadi, lekin undirilmaydi (Faza 1-2 da rate = 0)
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  commission_due  NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- To'lov offline: sotuvchi qo'lda belgilaydi
  payment_method  TEXT NOT NULL DEFAULT 'cash'
                  CHECK (payment_method IN ('cash','card_offline','transfer')),
  payment_status  TEXT NOT NULL DEFAULT 'unpaid'
                  CHECK (payment_status IN ('unpaid','paid')),

  seen_at         TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  ready_at        TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL,        -- yaratilgandan +24 soat
  reject_reason   TEXT,
  cancel_reason   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- delivery bo'lsa manzil koordinatasi majburiy
  CONSTRAINT delivery_needs_coords CHECK (
    delivery_type = 'pickup'
    OR (address ? 'lat' AND address ? 'lng')
  )
);

CREATE INDEX orders_user_idx   ON orders (user_id, created_at DESC);
CREATE INDEX orders_store_idx  ON orders (store_id, status, created_at DESC);
CREATE INDEX orders_number_idx ON orders (order_number);
-- Cron uchun: muddati o'tgan yangi buyurtmalarni topish
CREATE INDEX orders_expiry_idx ON orders (expires_at) WHERE status = 'new';
-- Ochiq buyurtma limitini tekshirish uchun
CREATE INDEX orders_open_idx   ON orders (user_id)
  WHERE status IN ('new','seen','confirmed','ready');


CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id  UUID NOT NULL REFERENCES product_variants(id),
  size        TEXT NOT NULL,
  qty         INT NOT NULL CHECK (qty > 0),
  unit_price  NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  -- O'zgarmas nusxa: { title, image, brand, colorName, sku }
  -- Mahsulot keyin o'zgarsa ham buyurtma tarixi buzilmaydi
  snapshot    JSONB NOT NULL
);

CREATE INDEX order_items_order_idx ON order_items (order_id);


-- ============================================================
-- STATUS TARIXI (nizolarni hal qilish uchun)
-- ============================================================

CREATE TABLE order_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_type  TEXT NOT NULL
              CHECK (actor_type IN ('customer','store','system','admin')),
  actor_id    UUID,
  channel     TEXT CHECK (channel IN ('app','panel','telegram','cron')),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX order_events_idx ON order_events (order_id, created_at);


-- ============================================================
-- QORA RO'YXAT (soxta buyurtmaga qarshi 3-qatlam)
-- store_id NULL = global blok
-- ============================================================

CREATE TABLE order_blocklist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID REFERENCES stores(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  user_id    UUID REFERENCES users(id),
  reason     TEXT NOT NULL,
  created_by TEXT NOT NULL CHECK (created_by IN ('store','admin','system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULLS NOT DISTINCT: global blok ham unikal bo'lsin (PG15+)
  UNIQUE NULLS NOT DISTINCT (store_id, phone)
);

CREATE INDEX blocklist_phone_idx  ON order_blocklist (phone);
CREATE INDEX blocklist_global_idx ON order_blocklist (phone) WHERE store_id IS NULL;


-- ============================================================
-- KOMISSIYA HISOBOTI (pul harakati yo'q, faqat hisob)
-- ============================================================

CREATE TABLE store_invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id),
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  orders_count INT NOT NULL,
  gross_amount NUMERIC(14,2) NOT NULL,
  commission   NUMERIC(14,2) NOT NULL,
  currency     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','sent','paid','written_off')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, period_start)
);
```

---

## 7. `006_looks.sql`

```sql
-- ============================================================
-- SAQLANGAN KOMPLEKTLAR
-- ============================================================

CREATE TABLE looks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT,
  thumbnail_url TEXT,
  created_by    TEXT NOT NULL DEFAULT 'user'
                CHECK (created_by IN ('user','ai_designer')),
  occasion      TEXT,                  -- ai_designer uchun: "date_night" ...
  is_public     BOOLEAN NOT NULL DEFAULT false,
  likes         INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX looks_user_idx   ON looks (user_id, created_at DESC);
CREATE INDEX looks_public_idx ON looks (likes DESC) WHERE is_public;


CREATE TABLE look_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id    UUID NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  slot       TEXT NOT NULL,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  size       TEXT,
  UNIQUE (look_id, slot)              -- bir slotda bitta mahsulot
);


CREATE TABLE favorites (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX favorites_product_idx ON favorites (product_id);


-- ============================================================
-- TRY-ON TARIXI (analitika: qaysi mahsulot ko'p kiyib ko'rilgan)
-- ============================================================

CREATE TABLE tryon_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tryon_variant_idx ON tryon_events (variant_id, created_at DESC);
CREATE INDEX tryon_date_idx    ON tryon_events (created_at);
```

---

## 8. `007_functions.sql`

```sql
-- ============================================================
-- 1) updated_at avtomatik yangilanishi
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated    BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER stores_updated   BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 2) Buyurtma raqami: LS-260812-0043
-- ============================================================

CREATE OR REPLACE FUNCTION next_order_number() RETURNS TEXT AS $$
DECLARE n INT;
BEGIN
  INSERT INTO order_counters (day, counter)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (day) DO UPDATE SET counter = order_counters.counter + 1
  RETURNING counter INTO n;

  RETURN 'LS-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' || lpad(n::text, 4, '0');
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION prepare_order() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := next_order_number();
  END IF;
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_prepare BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION prepare_order();


-- ============================================================
-- 3) Status o'zgarishini jurnalga yozish
-- Ilova `SET LOCAL app.actor_type = 'store'` qilib yuboradi
-- ============================================================

CREATE OR REPLACE FUNCTION log_order_status() RETURNS TRIGGER AS $$
DECLARE
  a_type TEXT := COALESCE(current_setting('app.actor_type', true), 'system');
  a_id   TEXT := current_setting('app.actor_id', true);
  a_ch   TEXT := current_setting('app.channel', true);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_events (order_id, from_status, to_status,
                              actor_type, actor_id, channel)
    VALUES (NEW.id, NULL, NEW.status, a_type, a_id::UUID, a_ch);

  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_events (order_id, from_status, to_status,
                              actor_type, actor_id, channel)
    VALUES (NEW.id, OLD.status, NEW.status, a_type, a_id::UUID, a_ch);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_log_insert AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status();
CREATE TRIGGER orders_log_update AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status();


-- ============================================================
-- 4) Vaqt belgilarini avtomatik qo'yish
-- ============================================================

CREATE OR REPLACE FUNCTION stamp_order_times() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'seen'      THEN NEW.seen_at      := COALESCE(NEW.seen_at, now());
      WHEN 'confirmed' THEN NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
      WHEN 'ready'     THEN NEW.ready_at     := COALESCE(NEW.ready_at, now());
      WHEN 'completed' THEN NEW.completed_at := COALESCE(NEW.completed_at, now());
      ELSE NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_stamp BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION stamp_order_times();


-- ============================================================
-- 5) user_trust avtomatik yangilanishi
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_trust() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_trust (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF TG_OP = 'INSERT' THEN
    UPDATE user_trust SET orders_total = orders_total + 1, updated_at = now()
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE user_trust SET
      orders_completed = orders_completed + (NEW.status = 'completed')::int,
      orders_cancelled = orders_cancelled + (NEW.status = 'cancelled')::int,
      orders_expired   = orders_expired   + (NEW.status = 'expired')::int,
      updated_at = now()
    WHERE user_id = NEW.user_id;

    -- 3 marta expired/cancelled → 7 kun cheklov
    UPDATE user_trust SET
      is_restricted = true,
      restricted_until = now() + interval '7 days',
      restriction_note = 'auto: 3+ bekor qilingan yoki javobsiz buyurtma'
    WHERE user_id = NEW.user_id
      AND (orders_cancelled + orders_expired + orders_noshow) >= 3
      AND orders_completed = 0
      AND NOT is_restricted;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_trust_insert AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION update_user_trust();
CREATE TRIGGER orders_trust_update AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_user_trust();


-- ============================================================
-- 6) 3 do'kon bloklasa → global blok
-- ============================================================

CREATE OR REPLACE FUNCTION escalate_blocklist() RETURNS TRIGGER AS $$
DECLARE cnt INT;
BEGIN
  IF NEW.store_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(DISTINCT store_id) INTO cnt
  FROM order_blocklist
  WHERE phone = NEW.phone AND store_id IS NOT NULL;

  IF cnt >= 3 THEN
    INSERT INTO order_blocklist (store_id, phone, user_id, reason, created_by)
    VALUES (NULL, NEW.phone, NEW.user_id,
            format('auto: %s ta do''kon bloklagan', cnt), 'system')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blocklist_escalate AFTER INSERT ON order_blocklist
  FOR EACH ROW EXECUTE FUNCTION escalate_blocklist();


-- ============================================================
-- 7) has_3d bayrog'ini yangilash
-- ============================================================

CREATE OR REPLACE FUNCTION sync_product_has_3d() RETURNS TRIGGER AS $$
DECLARE pid UUID;
BEGIN
  SELECT product_id INTO pid FROM product_variants
  WHERE id = COALESCE(NEW.variant_id, OLD.variant_id);

  UPDATE products p SET has_3d = EXISTS (
    SELECT 1 FROM product_variants v
    JOIN assets_3d a ON a.variant_id = v.id
    WHERE v.product_id = pid AND a.status = 'ready'
  ) WHERE p.id = pid;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assets_sync_has3d
  AFTER INSERT OR UPDATE OF status OR DELETE ON assets_3d
  FOR EACH ROW EXECUTE FUNCTION sync_product_has_3d();
```

---

## 9. `008_seed.sql`

```sql
-- ============================================================
-- KATEGORIYALAR
-- ============================================================

INSERT INTO categories (id, parent_id, slug, name, slot, size_type, sort_order) VALUES
-- Ildizlar
('11111111-0000-0000-0000-000000000001', NULL, 'tops',
 '{"uz":"Ustki kiyim","ru":"Верхняя одежда","en":"Tops"}', 'top', 'clothing', 1),
('11111111-0000-0000-0000-000000000002', NULL, 'bottoms',
 '{"uz":"Pastki kiyim","ru":"Низ","en":"Bottoms"}', 'bottom', 'clothing', 2),
('11111111-0000-0000-0000-000000000003', NULL, 'shoes',
 '{"uz":"Oyoq kiyim","ru":"Обувь","en":"Shoes"}', 'feet', 'shoes', 3),
('11111111-0000-0000-0000-000000000004', NULL, 'headwear',
 '{"uz":"Bosh kiyim","ru":"Головные уборы","en":"Headwear"}', 'head', 'onesize', 4),
('11111111-0000-0000-0000-000000000005', NULL, 'accessories',
 '{"uz":"Aksessuar","ru":"Аксессуары","en":"Accessories"}', NULL, 'onesize', 5);

INSERT INTO categories (parent_id, slug, name, slot, size_type, sort_order) VALUES
-- Ustki kiyim
('11111111-0000-0000-0000-000000000001', 'tshirt',
 '{"uz":"Futbolka","ru":"Футболка","en":"T-Shirt"}', 'top', 'clothing', 1),
('11111111-0000-0000-0000-000000000001', 'shirt',
 '{"uz":"Ko''ylak","ru":"Рубашка","en":"Shirt"}', 'top', 'clothing', 2),
('11111111-0000-0000-0000-000000000001', 'hoodie',
 '{"uz":"Xudi","ru":"Худи","en":"Hoodie"}', 'top', 'clothing', 3),
('11111111-0000-0000-0000-000000000001', 'sweater',
 '{"uz":"Sviter","ru":"Свитер","en":"Sweater"}', 'top', 'clothing', 4),
('11111111-0000-0000-0000-000000000001', 'jacket',
 '{"uz":"Kurtka","ru":"Куртка","en":"Jacket"}', 'outer', 'clothing', 5),
('11111111-0000-0000-0000-000000000001', 'coat',
 '{"uz":"Palto","ru":"Пальто","en":"Coat"}', 'outer', 'clothing', 6),
-- Pastki kiyim
('11111111-0000-0000-0000-000000000002', 'jeans',
 '{"uz":"Jinsi","ru":"Джинсы","en":"Jeans"}', 'bottom', 'clothing', 1),
('11111111-0000-0000-0000-000000000002', 'trousers',
 '{"uz":"Shim","ru":"Брюки","en":"Trousers"}', 'bottom', 'clothing', 2),
('11111111-0000-0000-0000-000000000002', 'shorts',
 '{"uz":"Shorti","ru":"Шорты","en":"Shorts"}', 'bottom', 'clothing', 3),
('11111111-0000-0000-0000-000000000002', 'skirt',
 '{"uz":"Yubka","ru":"Юбка","en":"Skirt"}', 'bottom', 'clothing', 4),
-- Oyoq kiyim
('11111111-0000-0000-0000-000000000003', 'sneakers',
 '{"uz":"Krossovka","ru":"Кроссовки","en":"Sneakers"}', 'feet', 'shoes', 1),
('11111111-0000-0000-0000-000000000003', 'dress-shoes',
 '{"uz":"Tufli","ru":"Туфли","en":"Dress Shoes"}', 'feet', 'shoes', 2),
('11111111-0000-0000-0000-000000000003', 'boots',
 '{"uz":"Botinka","ru":"Ботинки","en":"Boots"}', 'feet', 'shoes', 3),
('11111111-0000-0000-0000-000000000003', 'sandals',
 '{"uz":"Sandal","ru":"Сандалии","en":"Sandals"}', 'feet', 'shoes', 4),
-- Bosh kiyim
('11111111-0000-0000-0000-000000000004', 'cap',
 '{"uz":"Kepka","ru":"Кепка","en":"Cap"}', 'head', 'onesize', 1),
('11111111-0000-0000-0000-000000000004', 'hat',
 '{"uz":"Shlyapa","ru":"Шляпа","en":"Hat"}', 'head', 'onesize', 2),
('11111111-0000-0000-0000-000000000004', 'beanie',
 '{"uz":"Beanie","ru":"Шапка","en":"Beanie"}', 'head', 'onesize', 3),
-- Aksessuar
('11111111-0000-0000-0000-000000000005', 'glasses',
 '{"uz":"Ko''zoynak","ru":"Очки","en":"Glasses"}', 'face', 'onesize', 1),
('11111111-0000-0000-0000-000000000005', 'watch',
 '{"uz":"Soat","ru":"Часы","en":"Watch"}', 'wrist', 'onesize', 2),
('11111111-0000-0000-0000-000000000005', 'bag',
 '{"uz":"Sumka","ru":"Сумка","en":"Bag"}', 'bag', 'onesize', 3),
('11111111-0000-0000-0000-000000000005', 'belt',
 '{"uz":"Kamar","ru":"Ремень","en":"Belt"}', NULL, 'clothing', 4),
('11111111-0000-0000-0000-000000000005', 'scarf',
 '{"uz":"Sharf","ru":"Шарф","en":"Scarf"}', 'neck', 'onesize', 5);


-- ============================================================
-- BRENDLAR — hozircha shartnomasiz, is_partner = false
-- ⚠️ Logolar shartnomasiz ishlatilmaydi (00-README, 8-bo'lim)
-- ============================================================

INSERT INTO brands (name, slug, is_partner, sort_order) VALUES
('Nike','nike',false,1),
('Adidas','adidas',false,2),
('Zara','zara',false,3),
('Puma','puma',false,4),
('New Balance','new-balance',false,5),
('Uniqlo','uniqlo',false,6),
('Local Brand','local',false,99);
```

### Test ma'lumotlari (faqat dev muhitida)

```sql
-- Toshkent va Dubaydan bittadan test do'koni
INSERT INTO users (id, phone, full_name, role, country, gender) VALUES
('22222222-0000-0000-0000-000000000001','+998901234567','Test Sotuvchi','store_owner','UZ','male'),
('22222222-0000-0000-0000-000000000002','+971501234567','Test Seller','store_owner','AE','male');

INSERT INTO stores (owner_id, name, slug, location, address, city, country,
                    phone, currency, status, working_hours)
VALUES
('22222222-0000-0000-0000-000000000001','Chilonzor Fashion','chilonzor-fashion',
 ST_MakePoint(69.2041, 41.2756)::geography,
 'Chilonzor tumani, Bunyodkor ko''chasi 12','Toshkent','UZ',
 '+998901234567','UZS','active',
 '[{"day":1,"open":"10:00","close":"22:00"},{"day":2,"open":"10:00","close":"22:00"}]'),

('22222222-0000-0000-0000-000000000002','Dubai Mall Store','dubai-mall-store',
 ST_MakePoint(55.2796, 25.1972)::geography,
 'Dubai Mall, Ground Floor','Dubai','AE',
 '+971501234567','AED','active',
 '[{"day":1,"open":"10:00","close":"00:00"}]');
```

---

## 10. Asosiy so'rovlar

### 10.1 Yaqin do'konlar ⭐

```sql
SELECT
  s.id, s.name, s.logo_url, s.address, s.rating, s.currency,
  ST_Distance(s.location, ST_MakePoint($lng, $lat)::geography)::int AS distance_m,
  COUNT(p.id) FILTER (WHERE p.status = 'active') AS product_count,
  COUNT(p.id) FILTER (WHERE p.status = 'active' AND p.has_3d) AS product_3d_count
FROM stores s
LEFT JOIN products p ON p.store_id = s.id
WHERE s.status = 'active'
  AND ST_DWithin(s.location, ST_MakePoint($lng, $lat)::geography, $radius_m)
GROUP BY s.id
ORDER BY s.location <-> ST_MakePoint($lng, $lat)::geography
LIMIT $limit;
```

`<->` — KNN operatori, GIST index'dan foydalanadi. `ORDER BY ST_Distance(...)` yozsangiz index ishlamaydi va butun jadval skanerlanadi. **Bu farqni yodda tuting.**

### 10.2 Katalog filtri (keyset pagination)

```sql
SELECT p.id, p.title, p.base_price, p.currency, p.images, p.has_3d,
       b.name AS brand_name, s.name AS store_name
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
JOIN stores s ON s.id = p.store_id
WHERE p.status = 'active'
  AND s.status = 'active'
  AND ($category_id IS NULL OR p.category_id = $category_id)
  AND ($gender IS NULL OR p.gender IN ($gender, 'unisex'))
  AND ($brand_id IS NULL OR p.brand_id = $brand_id)
  AND ($store_id IS NULL OR p.store_id = $store_id)
  AND ($price_min IS NULL OR p.base_price >= $price_min)
  AND ($price_max IS NULL OR p.base_price <= $price_max)
  AND ($only_3d = false OR p.has_3d)
  AND ($cursor IS NULL OR (p.created_at, p.id) < ($cursor_at, $cursor_id))
ORDER BY p.created_at DESC, p.id DESC
LIMIT 20;
```

`OFFSET` ishlatilmaydi — 10 000-sahifada juda sekinlashadi. Keyset pagination doim bir xil tez.

### 10.3 Try-On: slot bo'yicha mahsulotlar (svayp uchun)

```sql
SELECT v.id AS variant_id, p.id AS product_id, p.title, p.base_price,
       v.color_hex, v.color_name,
       a.glb_url, a.lod_urls, a.hide_body_parts, a.file_size_bytes
FROM product_variants v
JOIN products p  ON p.id = v.product_id
JOIN assets_3d a ON a.variant_id = v.id
JOIN stores s    ON s.id = p.store_id
WHERE a.status = 'ready'
  AND p.status = 'active'
  AND s.status = 'active'
  AND p.slot = $slot
  AND p.gender IN ($gender, 'unisex')
  AND ($store_id IS NULL OR p.store_id = $store_id)
ORDER BY p.tryon_count DESC, p.created_at DESC
LIMIT 50;
```

### 10.4 Buyurtma yaratishdan oldingi tekshiruvlar

```sql
-- 1) Telefon tasdiqlanganmi?
SELECT EXISTS (
  SELECT 1 FROM verified_phones
  WHERE user_id = $user_id AND phone = $phone
) AS phone_ok;

-- 2) Qora ro'yxatda bormi (do'kon yoki global)?
SELECT EXISTS (
  SELECT 1 FROM order_blocklist
  WHERE phone = $phone AND (store_id IS NULL OR store_id = $store_id)
) AS blocked;

-- 3) Cheklanganmi?
SELECT is_restricted AND (restricted_until IS NULL OR restricted_until > now())
  AS restricted
FROM user_trust WHERE user_id = $user_id;

-- 4) Ochiq buyurtmalar soni
SELECT COUNT(*) FROM orders
WHERE user_id = $user_id
  AND status IN ('new','seen','confirmed','ready');   -- < 3 bo'lishi kerak

-- 5) Kunlik limit
SELECT COUNT(*) FROM orders
WHERE user_id = $user_id AND created_at > now() - interval '24 hours';  -- < 5

-- 6) Manzil do'kon radiusidami?
SELECT ST_DWithin(location, ST_MakePoint($lng, $lat)::geography, delivery_radius_m)
FROM stores WHERE id = $store_id;
```

### 10.5 Buyurtma yaratish (tranzaksiya)

```sql
BEGIN;

SET LOCAL app.actor_type = 'customer';
SET LOCAL app.actor_id   = '<user_id>';
SET LOCAL app.channel    = 'app';

-- Omborni bloklab olish (parallel buyurtmalardan himoya)
SELECT id, stock, reserved FROM variant_stock
WHERE variant_id = ANY($variant_ids) FOR UPDATE;

-- Yetarli emasmi → ROLLBACK

INSERT INTO orders (user_id, store_id, delivery_type, contact_name,
                    contact_phone, address, note, subtotal, delivery_fee,
                    total, currency, commission_rate, commission_due)
VALUES (...) RETURNING id, order_number;

INSERT INTO order_items (order_id, variant_id, size, qty,
                         unit_price, total_price, snapshot)
VALUES (...);

-- Rezerv qilish
UPDATE variant_stock SET reserved = reserved + $qty
WHERE variant_id = $vid AND size = $size;

DELETE FROM cart_items WHERE cart_id = $cart_id;

COMMIT;
```

### 10.6 Do'kon dashboard statistikasi

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'new')                          AS new_orders,
  COUNT(*) FILTER (WHERE status IN ('seen','confirmed','ready'))  AS in_progress,
  COUNT(*) FILTER (WHERE status = 'completed'
                   AND completed_at > date_trunc('month', now()))  AS completed_month,
  COALESCE(SUM(total) FILTER (WHERE status = 'completed'
                   AND completed_at > date_trunc('month', now())), 0) AS revenue_month,
  ROUND(AVG(EXTRACT(EPOCH FROM (seen_at - created_at))/60)
        FILTER (WHERE seen_at IS NOT NULL
                AND created_at > now() - interval '30 days'))      AS avg_response_min
FROM orders
WHERE store_id = $store_id;
```

### 10.7 Do'kon javob tezligi (cron, kuniga bir marta)

```sql
UPDATE stores s SET
  avg_response_min = st.avg_min,
  confirm_rate     = st.confirm_rate
FROM (
  SELECT store_id,
         ROUND(AVG(EXTRACT(EPOCH FROM (seen_at - created_at))/60)) AS avg_min,
         ROUND(COUNT(*) FILTER (WHERE status IN ('confirmed','ready','completed'))
               ::numeric / NULLIF(COUNT(*),0), 3) AS confirm_rate
  FROM orders
  WHERE created_at > now() - interval '30 days'
  GROUP BY store_id
) st
WHERE s.id = st.store_id;
```

### 10.8 Muddati o'tgan buyurtmalar (cron, har 5 daqiqada)

```sql
UPDATE orders
SET status = 'expired'
WHERE status = 'new' AND expires_at < now()
RETURNING id, user_id, store_id, order_number;
-- → mijozga push, do'kon reytingiga ta'sir
```

### 10.9 Oylik komissiya hisoboti (cron, oy boshida)

```sql
INSERT INTO store_invoices (store_id, period_start, period_end,
                            orders_count, gross_amount, commission, currency)
SELECT store_id,
       date_trunc('month', now() - interval '1 month')::date,
       (date_trunc('month', now()) - interval '1 day')::date,
       COUNT(*), SUM(total), SUM(commission_due), currency
FROM orders
WHERE status = 'completed'
  AND completed_at >= date_trunc('month', now() - interval '1 month')
  AND completed_at <  date_trunc('month', now())
GROUP BY store_id, currency
ON CONFLICT (store_id, period_start) DO NOTHING;
```

---

## 11. Index'lar va sabablari

| Index | Jadval | Nima uchun |
|---|---|---|
| `stores_location_idx` (GIST) | stores | ⭐ Yaqin do'konlar. Bu bo'lmasa butun jadval skanerlanadi |
| `products_slot_idx` | products | Try-On svayp — eng tez-tez ishlaydigan so'rov |
| `products_search_idx` (GIN) | products | To'liq matnli qidiruv |
| `products_title_trgm` (GIN) | products | Xato yozilgan qidiruv: "nayk" → "Nike" |
| `orders_open_idx` (partial) | orders | Ochiq buyurtma limitini tekshirish |
| `orders_expiry_idx` (partial) | orders | Cron har 5 daqiqada ishlaydi — arzon bo'lishi kerak |
| `blocklist_phone_idx` | order_blocklist | Har buyurtmada tekshiriladi |
| `verified_phones_phone_idx` | verified_phones | Har buyurtmada tekshiriladi |
| `stock_available_idx` (partial) | variant_stock | Faqat mavjud tovarlar |

**Partial index** (`WHERE ...` bilan) kichikroq va tezroq — faqat kerakli qatorlarni saqlaydi.

### Index'lar ishlayotganini tekshirish

```sql
EXPLAIN ANALYZE
SELECT id, name FROM stores
WHERE status = 'active'
  AND ST_DWithin(location, ST_MakePoint(69.24, 41.31)::geography, 5000)
ORDER BY location <-> ST_MakePoint(69.24, 41.31)::geography
LIMIT 20;
-- "Index Scan using stores_location_idx" bo'lishi kerak
-- "Seq Scan" chiqsa — index ishlamayapti
```

### Ishlatilmayotgan index'larni topish

```sql
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey'
ORDER BY relname;
```

---

## 12. Backup va tiklash

### Kunlik backup (cron, 03:00 UTC)

```bash
#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y%m%d-%H%M)
FILE="/tmp/looksave-${DATE}.dump"

pg_dump "$DATABASE_URL" --format=custom --compress=9 --file="$FILE"

# Cloudflare R2 ga yuklash (S3-mos)
aws s3 cp "$FILE" "s3://looksave-backups/db/looksave-${DATE}.dump" \
  --endpoint-url "$R2_ENDPOINT"

rm -f "$FILE"

# 30 kundan eski nusxalarni o'chirish
aws s3 ls "s3://looksave-backups/db/" --endpoint-url "$R2_ENDPOINT" \
  | awk '$1 < "'$(date -d '30 days ago' +%Y-%m-%d)'" {print $4}' \
  | xargs -r -I{} aws s3 rm "s3://looksave-backups/db/{}" \
      --endpoint-url "$R2_ENDPOINT"
```

### Tiklash

```bash
aws s3 cp "s3://looksave-backups/db/looksave-20260812-0300.dump" ./restore.dump \
  --endpoint-url "$R2_ENDPOINT"

pg_restore --clean --if-exists --no-owner \
  --dbname "$DATABASE_URL" ./restore.dump
```

### ⚠️ Tiklashni sinab ko'ring

Backup skripti ishlayotgani — backup ishlayotganini anglatmaydi. **Oyiga bir marta** bo'sh bazaga tiklab ko'ring va ma'lumot to'liqligini tekshiring. Sinalmagan backup — backup emas.

```sql
-- Tiklashdan keyin tekshiruv
SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'stores', COUNT(*) FROM stores
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'orders', COUNT(*) FROM orders;
```

---

## 13. Kuzatuv

### Sekin so'rovlar

```sql
SELECT calls, ROUND(mean_exec_time::numeric, 2) AS avg_ms,
       ROUND(total_exec_time::numeric) AS total_ms,
       LEFT(query, 90) AS query
FROM pg_stat_statements
WHERE mean_exec_time > 50
ORDER BY total_exec_time DESC
LIMIT 20;
```

### Jadval hajmlari

```sql
SELECT relname,
       pg_size_pretty(pg_total_relation_size(relid)) AS total,
       n_live_tup AS rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 15;
```

### Kunlik tozalash

```sql
DELETE FROM otp_codes    WHERE expires_at < now() - interval '1 day';
DELETE FROM tryon_events WHERE created_at < now() - interval '90 days';
```

---

## 14. Faza 3'da to'lov qo'shilganda

Sxema buzilmaydi — faqat qo'shiladi:

```sql
-- 009_payments.sql (Faza 3)
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  provider        TEXT NOT NULL,   -- payme | click | telr | stripe
  provider_txn_id TEXT,
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  raw_response    JSONB,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE store_balances (
  store_id  UUID PRIMARY KEY REFERENCES stores(id),
  available NUMERIC(14,2) NOT NULL DEFAULT 0,
  pending   NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency  TEXT NOT NULL
);

ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new','paid','seen','confirmed','rejected',
                    'ready','completed','cancelled','expired','refunded'));
```

`orders.payment_status` va `commission_due` allaqachon mavjud — undirish mexanizmi ulanadi, bugungi kod tashlanmaydi.
