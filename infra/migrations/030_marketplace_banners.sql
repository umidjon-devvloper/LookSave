-- 030_marketplace_banners.sql
-- Marketplace kolleksiyalarida har 6 mahsulotdan keyin chiqadigan bannerlar.

CREATE TABLE marketplace_banners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(100) NOT NULL,
  subtitle    VARCHAR(180),
  image_url   TEXT NOT NULL,
  target_url  TEXT,
  audience    VARCHAR(16) NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all', 'men', 'women', 'limited')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 9999),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_banners_active_idx
  ON marketplace_banners (audience, sort_order, created_at)
  WHERE is_active;

COMMENT ON TABLE marketplace_banners IS
  'Marketplace kolleksiyalarida mahsulot qatorlari orasida ko`rsatiladigan admin bannerlari.';
