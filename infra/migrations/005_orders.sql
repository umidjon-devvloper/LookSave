-- 005_orders.sql
-- Savat, buyurtmalar (to'lovsiz model, K-10), status tarixi, qora ro'yxat, komissiya.
-- docs/02-database.md §6

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
