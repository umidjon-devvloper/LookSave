-- 004_catalog.sql
-- Kategoriyalar, mahsulotlar, variantlar, ombor, 3D assetlar.
-- docs/02-database.md §5

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
