-- 006_looks.sql
-- Saqlangan komplektlar, sevimlilar, try-on tarixi.
-- docs/02-database.md §7

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
