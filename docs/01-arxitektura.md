# LookSave — Texnik Arxitektura v2.0

**Sana:** 2026-yil avgust
**Bozorlar:** Dubay (BAA) + Toshkent (O'zbekiston)
**Ko'lam:** Mobil ilova (Expo RN) + Web panellar (Vite React) + Backend (Node.js) + 3D pipeline

### v1.0 dan farqlar

| Qism | v1.0 | v2.0 | Sabab |
|---|---|---|---|
| Baza | MongoDB + PostgreSQL | **Faqat PostgreSQL + PostGIS** | Bitta VPS, bitta backup, kam RAM |
| Hosting | Managed servislar | **Bitta VPS + Docker Compose** | ~$700/oy tejaladi |
| Fayl xotirasi | S3 + CloudFront | **Cloudflare R2** | Egress bepul — 3D fayllar uchun hal qiluvchi |
| Xarita | Aniqlanmagan | **Google Maps mobil SDK** | Ikkala bozorda ishlaydi, mobil SDK bepul |
| Face scan | Server GPU | **Qurilmada (MediaPipe/ARKit)** | GPU xarajati nol |
| LLM | Aniqlanmagan | **Gemini free tier + Groq fallback** | Boshida $0 |
| To'lov | Online to'lov MVP'da | **To'lovsiz — buyurtma so'rovi modeli** | 3-4 hafta va yuridik yuk tejaladi |
| Oylik xarajat | ~$830 | **~$40** | |

---

## 1. Umumiy sxema

```
┌──────────────────────────────────────────────────────────────┐
│                       MIJOZ QATLAMI                          │
├───────────────────┬──────────────────┬───────────────────────┤
│  Mobil ilova      │  Do'kon kabineti │  Admin panel          │
│  Expo RN          │  Vite + React    │  Vite + React         │
│  + three.js/R3F   │  + Tailwind      │  + Tailwind           │
│  + Google Maps SDK│                  │                       │
└─────────┬─────────┴────────┬─────────┴──────────┬────────────┘
          │                  │                    │
          └──────────────────┼────────────────────┘
                             │ HTTPS
          ┌──────────────────▼───────────────────┐
          │        BITTA VPS (Hetzner)           │
          │  ┌────────────────────────────────┐  │
          │  │  Caddy — TLS, reverse proxy    │  │
          │  └───────────────┬────────────────┘  │
          │  ┌───────────────▼────────────────┐  │
          │  │  API — Node.js + Express       │  │
          │  │  auth│catalog│geo│order│avatar  │  │
          │  └───┬──────────────────────┬─────┘  │
          │      │                      │        │
          │  ┌───▼──────────────┐  ┌────▼─────┐  │
          │  │ PostgreSQL 16    │  │  Redis   │  │
          │  │ + PostGIS        │  │  kesh    │  │
          │  │ + JSONB          │  │  session │  │
          │  └──────────────────┘  └──────────┘  │
          │  ┌────────────────────────────────┐  │
          │  │  Backup — kunlik pg_dump → R2  │  │
          │  └────────────────────────────────┘  │
          └──────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────▼──────┐   ┌───────▼───────┐  ┌───────▼────────┐
   │Cloudflare R2│   │  Gemini API   │  │ Google Maps    │
   │ GLB, rasm   │   │  AI Designer  │  │ mobil SDK      │
   │ egress $0   │   │  (bepul tarif)│  │ (bepul)        │
   └─────────────┘   └───────────────┘  └────────────────┘
```

### Nega bitta VPS?

Faza 1-2 da foydalanuvchi soni kam, trafik kam, lekin ishlab chiqish tezligi muhim. Managed servislar (Atlas, RDS, ElastiCache) oyiga $300+ oladi va hech qanday afzallik bermaydi. Bitta VPS'da Docker Compose bilan hammasi turadi, `docker compose up` bilan ko'tariladi.

**Chegarasi:** ~50 000 faol foydalanuvchi yoki sekundiga ~200 so'rov. Undan keyin bazani alohida serverga chiqarish kerak — lekin bu kod o'zgarishini talab qilmaydi, faqat `DATABASE_URL` o'zgaradi.

### Nega faqat PostgreSQL?

| Kerak | PostgreSQL yechimi |
|---|---|
| Moslashuvchan katalog sxemasi | `JSONB` + GIN index |
| Geo-qidiruv | **PostGIS** — `ST_DWithin`, `<->` operatori |
| Buyurtma, to'lov, balans | Native ACID tranzaksiya |
| Matnli qidiruv | `tsvector` + `pg_trgm` |
| Analitika | Oddiy SQL, window funksiyalar |

Bitta baza = bitta backup, bitta monitoring, kam RAM. Solo developer uchun bu eng muhim yengillik.

---

## 2. Ilova oqimi

```
Splash
  ↓
Onboarding (3 ekran: g'oya, try-on, do'konlar)
  ↓
Kirish / Registratsiya  ─── telefon + SMS OTP
  ↓                          Apple ID / Google (ixtiyoriy)
Jins tanlash  ─────────── erkak / ayol → butun katalogni filtrlaydi
  ↓
Face Scan (o'tkazib yuborsa bo'ladi)
  ↓   qurilmada: old foto → yuz nuqtalari → tekstura
Tana o'lchamlari
  ↓   bo'y + vazn (majburiy)
  ↓   ko'krak, bel, son, oyoq razmeri (ixtiyoriy)
  ↓   → morph target parametrlari
Geolokatsiya ruxsati
  ↓
ASOSIY EKRAN (5 tab)
```

### Tab'lar

| Tab | Tarkib |
|---|---|
| **Home** | Yaqin do'konlar karuseli, brendlar, trend, limited drops, AI Designer tugmasi |
| **Try-On** | 3D avatar, svayp, slot boshqaruvi, komplekt saqlash |
| **Do'konlar** | Xarita / ro'yxat, filtr (masofa, kategoriya, brend, narx, ochiq) |
| **Savat** | Mahsulotlar, o'lcham, yetkazib berish turi, checkout |
| **Profil** | O'lchamlar, avatar, saqlangan look'lar, buyurtmalar, sozlamalar |

### Kategoriya daraxti

```
Ustki kiyim    → futbolka, ko'ylak, sviter, худи, kurtka, palto
Pastki kiyim   → shim, jinsi, shorti, yubka
Oyoq kiyim     → krossovka, tufli, botinka, sandal
Bosh kiyim     → kepka, shlyapa, beanie, bandana
Aksessuar      → ko'zoynak, soat, sumka, kamar, sirg'a, sharf
```

Har bir kategoriya 3D `slot` bilan bog'langan (quyida).

---

## 3. 3D Try-On tizimi

### 3.1 Asosiy qaror: generatsiya emas, almashtirish

| | AI generatsiya | 3D asset |
|---|---|---|
| Tezlik | 3-10 s | 0.2 s |
| Kiyim asli | Buziladi (logo, print) | Aynan o'zi |
| Barqarorlik | Har safar boshqacha | 100% bir xil |
| Svayp UX | Yaramaydi | Ideal |

Har bir kiyim oldindan 3D model qilib tayyorlanadi. Svayp = boshqa GLB yuklash. Do'kon uchun bu hayotiy: mijoz ko'rgan narsa bilan olgan narsa bir xil bo'lishi shart.

### 3.2 Slot arxitekturasi

Bitta standart skelet (Mixamo humanoid rig). Har bir kiyim — alohida GLB, skeletga bog'lanadi.

| Slot | Bog'lanish | Suyak / socket |
|---|---|---|
| `head` | Socket | `Head` |
| `face` | Socket | `Head` (ko'z oldi) |
| `neck` | Socket | `Neck` |
| `top` | Skinning | Butun tana |
| `outer` | Skinning | Butun tana (`top` ustidan) |
| `bottom` | Skinning | Bel + oyoq |
| `feet` | Socket | `LeftFoot`, `RightFoot` |
| `wrist` | Socket | `LeftHand`, `RightHand` |
| `bag` | Socket | `Spine` yoki `Hand` |

**Qoidalar:**
- Bir slotda bir vaqtda bitta model
- Har bir asset'da `hide_body_parts: []` — kiyim ostidagi tana qismi yashiriladi (Z-fighting oldini olish)
- `outer` kiyilganda `top`ning yeng qismi yashiriladi

### 3.3 Svayp mexanikasi

```
Barmoq teginishi
   ↓
Raycaster → 3D sahnaga nur
   ↓
mesh.userData.slot = "feet"
   ↓
Faol slot = "feet" (UI'da belgilanadi)
   ↓
Svayp ← / →  →  o'sha slotdagi keyingi mahsulot
   ↓
GLB: xotira kesh → disk kesh → R2 CDN
   ↓
Eskisini o'chirish, yangisini biriktirish
   ↓
Render (< 300 ms)
```

**Prefetch:** faol slotdagi keyingi 2 va oldingi 2 mahsulot fonda oldindan yuklanadi. Shunda svayp kutishsiz ishlaydi.

**Zonalar:**

| Teginish joyi | Faollashadigan slot |
|---|---|
| Bosh | `head` |
| Yuz | `face` |
| Ko'krak, qorin, yelka | `top` / `outer` |
| Son, tizza | `bottom` |
| Oyoq panjasi | `feet` |
| Bilak | `wrist` |

### 3.4 Tana o'lchami

Blendshape (morph target) orqali, real vaqtda, server so'rovisiz:

```js
morphTargets = {
  height: 0.62, weight: 0.48, shoulderWidth: 0.55,
  waist: 0.40, chest: 0.51, hips: 0.44
}
```

**Muhim:** har bir kiyim modeli ham **bir xil 6 ta blendshape'ga ega bo'lishi shart**. Bo'lmasa tana o'zgarganda kiyim tanaga kirib ketadi. Bu 3D artist uchun qo'shimcha ish — pipeline'da majburiy bosqich.

### 3.5 Animatsiya

| Nomi | Manba | Uzunlik |
|---|---|---|
| Idle | Mixamo | 4 s, loop |
| Turn | Mixamo | 3 s |
| Walk | Mixamo | 1.2 s, loop |
| Run | Mixamo | 0.9 s, loop |
| Sit | Mixamo | 3 s |

**Mato fizikasi ishlatilmaydi.** Real cloth simulation telefonni qotiradi. Kiyim skeletga skinning qilinadi, kerak bo'lsa 2-3 qo'shimcha suyak (palto etagi uchun). Ko'z farqlamaydi, 10 barobar tez.

### 3.6 Face scan — qurilmada, GPU'siz

| Vazifa | Yechim | Xarajat |
|---|---|---|
| Yuz nuqtalari (468 ta) | MediaPipe Face Mesh, qurilmada | $0 |
| iPhone aniq skan | ARKit TrueDepth | $0 |
| Tekstura olish | Foto crop + UV mapping | $0 |
| Tana proporsiyasi | MediaPipe Pose + bo'y | $0 |
| O'lchamlar | Statistik formula, serverda | $0 |

Natija: **tanib olinadigan avatar**, deckdagi darajada fotorealistik emas. Faza 1-2 uchun yetarli. Keyinchalik sifat yetmasa — Hugging Face ZeroGPU (bepul kvota) yoki RunPod serverless ($0.20-0.40/soat).

Uslub tanlovi: **stilizatsiyalangan realistik**. To'liq fotorealistik "uncanny valley" xavfini tug'diradi va telefonni qiynaydi.

---

## 4. 3D asset pipeline

```
1. MANBA — mahsulot fotolari (4-8 rakurs) + o'lcham jadvali
      ↓
2. MODELLASH — Blender / Marvelous Designer → 50-200k poligon
      ↓
3. RETOPOLOGY → 3 000-8 000 poligon
      ↓
4. UV + TEKSTURA — Substance Painter
   albedo + normal + roughness, har biri 1024×1024
      ↓
5. RIGGING — standart skeletga skinning + 6 ta blendshape + socket
      ↓
6. OPTIMIZATSIYA
   Draco (geometriya) → 70-90% kichrayadi
   KTX2/Basis (tekstura) → 60-80% kichrayadi
   LOD0 / LOD1 / LOD2
   Natija: 0.8-1.5 MB GLB
      ↓
7. TEST — iPhone 12+, Redmi Note, eski Android (4 GB RAM)
   FPS, yuklanish vaqti, RAM, batareya
      ↓
8. R2'ga yuklash + katalogga bog'lash
```

### Bitta mahsulot uchun vaqt

| Bosqich | Soat |
|---|---|
| Modellash | 3-6 |
| Retopology | 1-2 |
| Tekstura | 2-3 |
| Rigging + blendshape | 1-2 |
| Optimizatsiya + test | 1-2 |
| **Jami** | **8-15 soat** |

**AI vositalari bu bosqichni tezlashtirmaydi.** Bu loyihaning eng ko'p vaqt yeydigan qismi va rejalashtirish shu raqamdan boshlanishi kerak.

### Performance byudjeti

| Ko'rsatkich | Chegara |
|---|---|
| Avatar tanasi | ≤ 15 000 poligon |
| Bitta kiyim | ≤ 8 000 poligon |
| Sahnada jami | ≤ 60 000 poligon |
| GLB fayl | ≤ 1.5 MB |
| Tekstura | 1024×1024 KTX2 |
| Draw call | ≤ 30 |
| FPS flagman | 60 |
| FPS o'rta Android | ≥ 30 |
| Slot almashish | < 300 ms |
| Try-On ochilishi | < 2.5 s |
| RAM (sahna) | < 350 MB |

---

## 5. Ma'lumotlar bazasi (PostgreSQL + PostGIS)

### Kengaytmalar

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Asosiy jadvallar

```sql
-- ============ FOYDALANUVCHI ============
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT UNIQUE NOT NULL,
  email          TEXT UNIQUE,
  password_hash  TEXT,
  gender         TEXT CHECK (gender IN ('male','female')),
  role           TEXT NOT NULL DEFAULT 'customer'
                 CHECK (role IN ('customer','store_owner','admin')),
  locale         TEXT DEFAULT 'uz',
  created_at     TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ
);

CREATE TABLE profiles (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  measurements     JSONB NOT NULL DEFAULT '{}',
  -- { height:180, weight:82, chest:98, waist:84, hips:96,
  --   shoeSize:42, shoeSizeSystem:"EU" }
  morph_targets    JSONB NOT NULL DEFAULT '{}',
  -- { height:0.62, weight:0.48, shoulderWidth:0.55, ... }
  face_texture_url TEXT,
  face_scan_status TEXT DEFAULT 'none'
                   CHECK (face_scan_status IN ('none','processing','ready','failed')),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ============ DO'KON ============
CREATE TABLE brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  is_partner  BOOLEAN DEFAULT false
);

CREATE TABLE stores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID REFERENCES users(id),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  logo_url        TEXT,
  cover_url       TEXT,
  location        GEOGRAPHY(POINT, 4326) NOT NULL,
  address         TEXT,
  city            TEXT,
  country         TEXT,           -- 'AE' | 'UZ'
  phone           TEXT,
  working_hours   JSONB,          -- [{day:1, open:"10:00", close:"22:00"}]
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','active','suspended')),
  commission_rate NUMERIC(5,4) DEFAULT 0.10,
  delivery_radius_m INT DEFAULT 15000,   -- xizmat radiusi (geo tekshiruv uchun)
  rating          NUMERIC(2,1) DEFAULT 0,
  review_count    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX stores_location_idx ON stores USING GIST (location);
CREATE INDEX stores_city_idx     ON stores (city, status);

-- ============ KATALOG ============
CREATE TABLE products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  brand_id     UUID REFERENCES brands(id),
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL,   -- top|bottom|feet|head|accessory
  subcategory  TEXT,            -- tshirt|jacket|sneaker|...
  slot         TEXT NOT NULL,   -- 3D slot
  gender       TEXT NOT NULL CHECK (gender IN ('male','female','unisex')),
  base_price   NUMERIC(12,2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'USD',
  images       JSONB DEFAULT '[]',
  tags         TEXT[] DEFAULT '{}',
  is_limited   BOOLEAN DEFAULT false,
  status       TEXT DEFAULT 'draft'
               CHECK (status IN ('draft','active','archived')),
  search_vec   tsvector GENERATED ALWAYS AS (
                 to_tsvector('simple', coalesce(title,'') || ' ' ||
                                        coalesce(description,''))
               ) STORED,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX products_store_idx  ON products (store_id, status);
CREATE INDEX products_cat_idx    ON products (category, gender, status);
CREATE INDEX products_search_idx ON products USING GIN (search_vec);
CREATE INDEX products_tags_idx   ON products USING GIN (tags);

CREATE TABLE product_variants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_hex   TEXT,
  color_name  TEXT,
  images      JSONB DEFAULT '[]',
  price_delta NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE variant_stock (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  size       TEXT NOT NULL,
  sku        TEXT UNIQUE,
  stock      INT NOT NULL DEFAULT 0,
  UNIQUE (variant_id, size)
);

-- ============ 3D ASSET ============
CREATE TABLE assets_3d (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id       UUID UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
  glb_url          TEXT,
  lod_urls         JSONB DEFAULT '{}',   -- {lod0,lod1,lod2}
  file_size_bytes  INT,
  poly_count       INT,
  hide_body_parts  TEXT[] DEFAULT '{}',
  status           TEXT DEFAULT 'none'
                   CHECK (status IN ('none','queued','processing','ready','failed')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX assets_status_idx ON assets_3d (status);

-- ============ SAVAT VA BUYURTMA ============
CREATE TABLE carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  size       TEXT NOT NULL,
  qty        INT NOT NULL DEFAULT 1 CHECK (qty > 0)
);

-- To'lov tizimisiz model: buyurtma = sotuvchiga so'rov
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT UNIQUE NOT NULL,     -- LS-250812-0043
  user_id         UUID NOT NULL REFERENCES users(id),
  store_id        UUID NOT NULL REFERENCES stores(id),

  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','seen','confirmed','rejected',
                                    'ready','completed','cancelled','expired')),

  delivery_type   TEXT NOT NULL CHECK (delivery_type IN ('delivery','pickup')),
  contact_name    TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,            -- verified_phones dan bo'lishi SHART
  address         JSONB,                    -- delivery: { text, lat, lng, landmark }
                                            -- lat/lng majburiy — xaritada nuqta
  note            TEXT,                     -- mijoz izohi

  subtotal        NUMERIC(12,2) NOT NULL,
  delivery_fee    NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL,
  currency        TEXT NOT NULL,

  -- komissiya hisoblanadi, lekin undirilmaydi (oylik hisobot uchun)
  commission_rate NUMERIC(5,4) NOT NULL,
  commission_due  NUMERIC(12,2) NOT NULL,

  -- to'lov offline: sotuvchi qo'lda belgilaydi
  payment_method  TEXT DEFAULT 'cash'
                  CHECK (payment_method IN ('cash','card_offline','transfer')),
  payment_status  TEXT DEFAULT 'unpaid'
                  CHECK (payment_status IN ('unpaid','paid')),

  seen_at         TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL,     -- yaratilgandan +24 soat
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX orders_user_idx    ON orders (user_id, created_at DESC);
CREATE INDEX orders_store_idx   ON orders (store_id, status, created_at DESC);
CREATE INDEX orders_expiry_idx  ON orders (expires_at) WHERE status = 'new';

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id  UUID NOT NULL REFERENCES product_variants(id),
  size        TEXT NOT NULL,
  qty         INT NOT NULL,
  unit_price  NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  snapshot    JSONB   -- nom, rasm, brend, rang — o'zgarmas nusxa
);

-- Har bir status o'zgarishi jurnalga yoziladi (nizolarni hal qilish uchun)
CREATE TABLE order_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('customer','store','system','admin')),
  actor_id    UUID,
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX order_events_idx ON order_events (order_id, created_at);

-- Do'kon komissiya qarzi (oylik hisob-kitob, pul harakati yo'q)
CREATE TABLE store_invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  orders_count  INT NOT NULL,
  gross_amount  NUMERIC(14,2) NOT NULL,
  commission    NUMERIC(14,2) NOT NULL,
  currency      TEXT NOT NULL,
  status        TEXT DEFAULT 'open'
                CHECK (status IN ('open','sent','paid','written_off')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (store_id, period_start)
);

-- Mijoz ishonchliligi (soxta buyurtmadan himoya)
CREATE TABLE user_trust (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  orders_total    INT DEFAULT 0,
  orders_completed INT DEFAULT 0,
  orders_cancelled INT DEFAULT 0,
  orders_expired   INT DEFAULT 0,
  is_restricted   BOOLEAN DEFAULT false,
  restricted_until TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- OTP bilan tasdiqlangan raqamlar (buyurtma faqat shulardan beriladi)
CREATE TABLE verified_phones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,            -- E.164: +998901234567
  country     TEXT NOT NULL,            -- UZ | AE
  verified_at TIMESTAMPTZ DEFAULT now(),
  is_primary  BOOLEAN DEFAULT false,
  UNIQUE (user_id, phone)
);

CREATE INDEX verified_phones_idx ON verified_phones (phone);

-- Qora ro'yxat. store_id NULL = global blok (admin yoki avtomatik eskalatsiya)
CREATE TABLE order_blocklist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID REFERENCES stores(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  user_id    UUID REFERENCES users(id),
  reason     TEXT NOT NULL,
  created_by TEXT NOT NULL CHECK (created_by IN ('store','admin','system')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (store_id, phone)
);

CREATE INDEX blocklist_phone_idx ON order_blocklist (phone);

-- ============ LOOK'LAR ============
CREATE TABLE looks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT,
  thumbnail_url TEXT,
  created_by    TEXT DEFAULT 'user' CHECK (created_by IN ('user','ai_designer')),
  is_public     BOOLEAN DEFAULT false,
  likes         INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE look_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id    UUID NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  slot       TEXT NOT NULL,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  size       TEXT
);

CREATE TABLE favorites (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
```

### Yaqin do'konlar so'rovi

```sql
SELECT
  s.id, s.name, s.logo_url, s.address, s.rating,
  ST_Distance(s.location, ST_MakePoint($lng, $lat)::geography) AS distance_m
FROM stores s
WHERE s.status = 'active'
  AND ST_DWithin(s.location, ST_MakePoint($lng, $lat)::geography, $radius_m)
ORDER BY s.location <-> ST_MakePoint($lng, $lat)::geography
LIMIT 20;
```

GIST index bilan bu 100 000 do'konda ham 5 ms dan tez ishlaydi.

---

## 6. Buyurtma oqimi — to'lov tizimisiz

MVP'da onlayn to'lov yo'q. Buyurtma = **sotuvchiga yuboriladigan so'rov**. Pul mijoz va do'kon o'rtasida offline hal bo'ladi.

### Nega bu to'g'ri qaror

| Online to'lov bilan | To'lovsiz |
|---|---|
| Payme/Click/Stripe integratsiyasi — 3-4 hafta | 0 hafta |
| Yuridik shaxs, shartnoma, litsenziya | Kerak emas |
| Pulni ushlab turish, refund, chargeback | Kerak emas |
| Do'kon balansi, payout tizimi | Kerak emas |
| PCI DSS, xavfsizlik auditi | Kerak emas |
| Do'kon ishonchsizligi ("pulim qayerda?") | Do'kon pulni to'g'ridan-to'g'ri oladi |

Bu model O'zbekiston va Dubay bozorida allaqachon ishlaydi — do'konlar Instagram va Telegram orqali aynan shunday sotadi. LookSave ularga faqat yaxshiroq vitrina beradi.

### Status oqimi

```
                    ┌──────────┐
   Mijoz buyurtma → │   NEW    │ ← 24 soat taymer
   yuboradi         └────┬─────┘
                         │ sotuvchi ochdi
                    ┌────▼─────┐
                    │   SEEN   │
                    └────┬─────┘
              ┌──────────┴──────────┐
              │                     │
        ┌─────▼──────┐       ┌──────▼─────┐
        │ CONFIRMED  │       │  REJECTED  │ ← sabab majburiy
        └─────┬──────┘       └────────────┘   (yo'q / o'lcham yo'q / narx o'zgardi)
              │
        ┌─────▼──────┐
        │   READY    │  pickup: olib ketishga tayyor
        └─────┬──────┘  delivery: jo'natildi
              │
        ┌─────▼──────┐
        │ COMPLETED  │  sotuvchi "topshirildi + pul olindi" deb belgilaydi
        └────────────┘

Istalgan bosqichda:  CANCELLED (mijoz bekor qildi)
NEW holatida 24 soat: EXPIRED (sotuvchi javob bermadi)
```

### Mijoz tomonidan ko'rinishi

```
Savat → Buyurtma berish
   ↓
Yetkazib berish turi:  [ Do'kondan olib ketaman ]  [ Yetkazib berish ]
   ↓
Ism + telefon (avtomatik to'ladi, OTP allaqachon tasdiqlangan)
   ↓
Manzil (faqat delivery uchun) + izoh
   ↓
"Buyurtma yuborish"
   ↓
┌────────────────────────────────────────┐
│  Buyurtmangiz do'konga yuborildi       │
│  № LS-250812-0043                      │
│                                        │
│  Do'kon 24 soat ichida bog'lanadi.     │
│  To'lov do'konda yoki yetkazib berilganda│
│                                        │
│  ⏱ Kutilmoqda                          │
└────────────────────────────────────────┘
```

**Muhim UX qoidasi:** hech qayerda "To'lash", "Sotib olish", "Buy now" yozilmaydi. Faqat **"Buyurtma yuborish"** yoki **"Do'konga so'rov yuborish"**. Mijoz pul yechilishini kutmasligi kerak.

### Sotuvchi tomonidan ko'rinishi

Bu — tizimning eng muhim qismi. Sotuvchi buyurtmani **darhol** ko'rishi shart, aks holda mijoz kutib qoladi va ilovaga ishonchi yo'qoladi.

**Uchta kanal, parallel ishlaydi:**

| Kanal | Vazifa | Xarajat |
|---|---|---|
| **Telegram bot** | Asosiy kanal — bir zumda yetadi | $0 |
| Web panel | To'liq boshqaruv, tovush + badge | $0 |
| SMS | Zaxira: 15 daqiqa javob bo'lmasa | ~$0.02 |

**Telegram bot — nega asosiy?** Do'kon egasi kun bo'yi web panel oldida o'tirmaydi. Lekin Telegram telefonida doim ochiq. Bot bepul, cheksiz, bir zumda yetadi va tugmalar bilan javob berish mumkin:

```
🔔 Yangi buyurtma  № LS-250812-0043

👤 Aziz Karimov  +998 90 123 45 67
📦 Nike Air Max 90 — 42 razmer × 1
💰 1 250 000 so'm
🚚 Do'kondan olib ketadi

[ ✅ Tasdiqlash ]  [ ❌ Rad etish ]  [ 📋 Panelda ochish ]
```

Sotuvchi tugmani bosadi → status o'zgaradi → mijozga push ketadi. Web panelga kirmasa ham bo'ladi.

**Web paneldagi buyurtmalar ekrani:**

```
┌─ Yangi (3) ─┬─ Jarayonda (7) ─┬─ Yakunlangan ─┬─ Rad etilgan ─┐

№ LS-250812-0043          ⏱ 22 soat 14 daq qoldi
Aziz Karimov · +998 90 123 45 67
Nike Air Max 90 · 42 · ×1 · 1 250 000 so'm
Do'kondan olib ketadi

[ Tasdiqlash ]  [ Rad etish ]  [ Qo'ng'iroq ]
```

Tasdiqlangandan keyin: `[ Tayyor ]` → `[ Topshirildi va to'landi ]`

### Komissiya — pulsiz hisob

Pul tizim orqali o'tmaydi, lekin komissiya **hisoblanadi va yoziladi**:

```
Buyurtma COMPLETED bo'lganda
   ↓
commission_due = total × commission_rate
   ↓
Oy oxirida store_invoices jadvaliga yig'iladi
   ↓
Do'konga hisob yuboriladi (yoki Faza 1'da umuman undirilmaydi)
```

**Tavsiya:** Faza 1-2 da komissiyani **umuman undirmang**. Do'konlarni jalb qilish uchun "bepul, hech qanday komissiya yo'q" — eng kuchli argument. Raqamlar baribir yig'ilib boradi, keyinchalik ko'rsatasiz: "sizga 340 ta buyurtma keltirdik, endi 5% olamiz".

### Soxta buyurtmadan himoya — 4 qatlam

To'lov bo'lmagani uchun soxta buyurtma arzon. Bu MVP'ning asosiy xavfi va himoya qatlam-qatlam quriladi.

**Muhim tamoyil:** format tekshiruvi o'zi yetarli emas. `+998901234567` to'g'ri formatda, lekin mavjud bo'lmasligi mumkin. Haqiqiy himoya — raqamning **OTP bilan bog'langani**.

#### 1-qatlam: ma'lumot to'liqligi va formati

Buyurtma tugmasi quyidagilar to'g'ri to'ldirilmaguncha **o'chiq** turadi:

| Maydon | Qoida |
|---|---|
| Ism | ≥ 2 harf, raqam yo'q, faqat harf va probel |
| Telefon | E.164 + operator kodi tekshiriladi + `MOBILE` turi |
| Yetkazib berish turi | `delivery` yoki `pickup` — tanlanishi shart |
| **Xaritada nuqta (lat/lng)** | `delivery` uchun **majburiy** |
| Manzil matni | ≥ 10 belgi |
| Mo'ljal | ixtiyoriy |

Xaritadagi nuqta — eng kuchli filtr. Matn yozish oson, xaritada nuqta qo'yish soxta buyurtmachi uchun ancha ko'p harakat. Ustiga bu kuryer uchun baribir kerak.

**Geografik tekshiruv:** nuqta do'konning xizmat radiusidan tashqarida bo'lsa — bloklanadi.

```sql
SELECT ST_DWithin(
  s.location,
  ST_MakePoint($lng, $lat)::geography,
  s.delivery_radius_m
) AS in_range
FROM stores s WHERE s.id = $store_id;
```

**Telefon validatsiyasi** — qo'lda regex emas, `libphonenumber-js`:

```js
import { parsePhoneNumberFromString } from 'libphonenumber-js';

function validatePhone(input, country) {   // 'UZ' | 'AE'
  const p = parsePhoneNumberFromString(input, country);
  if (!p || !p.isValid()) return { ok: false, code: 'INVALID_FORMAT' };
  if (p.getType() !== 'MOBILE') return { ok: false, code: 'NOT_MOBILE' };
  return { ok: true, e164: p.number };      // +998901234567
}
```

#### 2-qatlam: OTP bog'lanishi (asosiy himoya)

Checkout'da foydalanuvchi raqamni **yozmaydi** — registratsiyada tasdiqlangan raqam avtomatik qo'yiladi:

```
Telefon:  +998 90 *** ** 67   ✅ tasdiqlangan
          [ Boshqa raqam kiritish ]
                 ↓
          Yangi raqam → SMS OTP → verified_phones ga qo'shiladi
```

Server tomonida qattiq tekshiruv:

```sql
-- Buyurtma yaratishdan oldin
SELECT 1 FROM verified_phones
WHERE user_id = $user_id AND phone = $contact_phone;
-- topilmasa → 403 PHONE_NOT_VERIFIED
```

Bu soxta buyurtmalarning katta qismini to'xtatadi: har bir soxta buyurtma uchun haqiqiy SIM karta kerak bo'ladi.

#### 3-qatlam: sotuvchi bloklashi

Rad etish oynasida sabab tanlanadi:

```
○ Mahsulot tugagan
○ O'lcham yo'q
○ Narx o'zgargan
● Soxta buyurtma / mijoz kelmadi
      ↓
  [ ✓ Bu raqamni bloklash ]
```

Bloklangan raqam **shu do'kondan** boshqa buyurtma bera olmaydi.

**Avtomatik eskalatsiya:** bir raqamni **3 xil do'kon** bloklasa → global qora ro'yxat → butun platformada buyurtma bera olmaydi. Admin ko'rib chiqadi va bekor qilishi mumkin.

```sql
-- Har blokdan keyin ishlaydi
INSERT INTO order_blocklist (store_id, phone, reason, created_by)
SELECT NULL, $phone, 'auto: 3+ do''kon bloklagan', 'system'
WHERE (SELECT COUNT(DISTINCT store_id) FROM order_blocklist
       WHERE phone = $phone AND store_id IS NOT NULL) >= 3
ON CONFLICT DO NOTHING;
```

Bitta do'konning bloki xato bo'lishi mumkin, uchtasi — allaqachon namuna.

#### 4-qatlam: xulq-atvor

| Chora | Chegara |
|---|---|
| Ochiq (tasdiqlanmagan) buyurtma | ≤ 3 |
| Kunlik buyurtma | ≤ 5 |
| Avtomatik cheklov | 3 marta expired/cancelled → 7 kun blok |
| Sotuvchi "kelmadi" tugmasi | `user_trust` ballga ta'sir |
| Yuqori summa (> $500) | Qo'shimcha SMS tasdiqlash |
| IP / qurilma | Bir qurilmadan ≤ 2 akkaunt |

#### Buyurtma yaratishdagi tekshiruv ketma-ketligi

```
POST /orders
  1. Auth?                                    → 401
  2. Maydonlar to'liq va formatga mos?        → 422 VALIDATION_ERROR
  3. contact_phone verified_phones da bormi?  → 403 PHONE_NOT_VERIFIED
  4. order_blocklist da bormi (do'kon/global)?→ 403 BLOCKED
  5. user_trust.is_restricted?                → 403 RESTRICTED
  6. Ochiq buyurtma < 3? Kunlik < 5?          → 429 LIMIT_REACHED
  7. delivery bo'lsa: lat/lng bor va radiusda?→ 422 OUT_OF_RANGE
  8. Mahsulot mavjud, ombor yetarli?          → 409 OUT_OF_STOCK
  ✓ Buyurtma yaratiladi (tranzaksiya ichida)
```

### Avtomatik jarayonlar (cron)

```
Har 5 daqiqada:
  • NEW holatida 15 daq → sotuvchiga SMS eslatma
  • NEW holatida 24 soat → EXPIRED + mijozga uzr xati + user_trust yangilanadi

Har kuni 09:00:
  • CONFIRMED holatida 3 kun → sotuvchiga eslatma
  • Do'kon javob berish tezligi hisoblanadi → reytingga ta'sir

Har oy 1-sanada:
  • store_invoices yaratiladi (komissiya hisoboti)
```

### Do'kon javob tezligi — reyting omili

```sql
-- O'rtacha javob vaqti va tasdiqlash foizi
SELECT
  store_id,
  AVG(EXTRACT(EPOCH FROM (seen_at - created_at))/60) AS avg_response_min,
  COUNT(*) FILTER (WHERE status = 'confirmed')::float / COUNT(*) AS confirm_rate,
  COUNT(*) FILTER (WHERE status = 'expired')::float / COUNT(*) AS ignore_rate
FROM orders
WHERE created_at > now() - interval '30 days'
GROUP BY store_id;
```

Sekin javob beradigan do'kon qidiruvda pastroq chiqadi. Bu do'konlarni intizomga soladi.

### Faza 3'da to'lov qo'shilganda

Sxema shunday qurilganki, to'lov qo'shish **buzilish talab qilmaydi**:

- `payments` jadvali qo'shiladi, `orders.payment_status` allaqachon bor
- Status oqimiga `PAID` qo'shiladi (`NEW` dan oldin yoki `CONFIRMED` dan keyin)
- `store_balances` va `payouts` jadvallari qo'shiladi
- `commission_due` allaqachon hisoblanadi — faqat undirish mexanizmi ulanadi
- Mobil ilovada checkout ekraniga to'lov qadami qo'shiladi

Ya'ni bugungi kod ertaga tashlanmaydi.

---

## 7. API endpointlar

```
AUTH
POST   /auth/send-otp
POST   /auth/verify-otp
POST   /auth/refresh
POST   /auth/logout

PROFIL / AVATAR
GET    /profile
PATCH  /profile/measurements
POST   /avatar/face-texture          ← qurilmada tayyorlangan tekstura
GET    /avatar/config                → morph + skeleton + textureUrl

GEO / DO'KONLAR
GET    /stores/nearby?lat=&lng=&radius=&category=&limit=
GET    /stores/:id
GET    /stores/:id/products
GET    /stores/map?bounds=           → klasterlangan marker'lar

KATALOG
GET    /products?category=&gender=&brand=&priceMin=&priceMax=&storeId=&q=
GET    /products/:id
GET    /variants/:id/asset3d
GET    /categories
GET    /brands

TRY-ON
GET    /tryon/slot/:slot?gender=&storeId=&cursor=
POST   /tryon/prefetch
POST   /looks
GET    /looks
DELETE /looks/:id

AI DESIGNER
POST   /ai/design   { occasion, mood, budget, storeId?, radius? }

SAVAT / BUYURTMA  (to'lovsiz)
GET    /cart
POST   /cart/items
PATCH  /cart/items/:id
DELETE /cart/items/:id
POST   /phones/send-otp               → qo'shimcha raqam tasdiqlash
POST   /phones/verify-otp
GET    /phones                        → tasdiqlangan raqamlar ro'yxati
POST   /orders                        → so'rov yaratadi, status = new
GET    /orders
GET    /orders/:id
GET    /orders/:id/events             → status tarixi
POST   /orders/:id/cancel

DO'KON KABINETI
GET    /store/dashboard
GET    /store/products
POST   /store/products
PATCH  /store/products/:id
POST   /store/products/:id/request-3d
GET    /store/orders?status=new
POST   /store/orders/:id/seen
POST   /store/orders/:id/confirm
POST   /store/orders/:id/reject       { reason }
POST   /store/orders/:id/ready
POST   /store/orders/:id/complete     { paymentMethod }
POST   /store/orders/:id/report-noshow
GET    /store/blocklist
POST   /store/blocklist               { phone, reason }
DELETE /store/blocklist/:id
GET    /store/analytics?from=&to=
GET    /store/invoices                → komissiya hisoboti (pulsiz)
GET    /store/telegram/link           → botni ulash uchun kod

TELEGRAM BOT
POST   /telegram/webhook              → tugma bosilishi → status o'zgarishi

ADMIN
GET    /admin/stores?status=pending
PATCH  /admin/stores/:id/approve
GET    /admin/products/moderation
GET    /admin/orders
GET    /admin/3d-queue
GET    /admin/analytics
```

---

## 8. Mobil ilova (Expo)

### Muhim: Expo Go yaramaydi

3D uchun `expo-gl` va native modullar kerak → **development build (EAS Build)**. Birinchi kundan sozlanadi.

```
app/
├── (auth)/
│   ├── onboarding.tsx
│   ├── phone.tsx
│   ├── otp.tsx
│   ├── gender.tsx
│   ├── face-scan.tsx
│   └── measurements.tsx
├── (tabs)/
│   ├── index.tsx           # Home
│   ├── tryon.tsx           # 3D
│   ├── stores.tsx          # Xarita + ro'yxat
│   ├── cart.tsx
│   └── profile.tsx
├── store/[id].tsx
├── product/[id].tsx
├── checkout/
├── orders/
└── ai-designer.tsx

src/
├── three/
│   ├── AvatarScene.tsx
│   ├── AvatarRig.ts            # skelet + morph
│   ├── SlotManager.ts
│   ├── AssetLoader.ts          # GLB + 3 qatlamli kesh
│   ├── RaycastHandler.ts
│   ├── AnimationController.ts
│   └── PerformanceMonitor.ts   # FPS → avtomatik LOD
├── maps/
│   ├── MapProvider.ts          # interfeys
│   ├── GoogleProvider.ts
│   └── MapLibreProvider.ts     # zaxira
├── api/                        # TanStack Query
├── store/                      # Zustand
├── components/
└── utils/
```

### Paketlar

```
expo ~52                      expo-location
expo-router                   expo-camera
expo-gl                       expo-file-system
expo-three                    react-native-maps (PROVIDER_GOOGLE)
three                         react-native-gesture-handler
@react-three/fiber            react-native-reanimated
@react-three/drei             @tanstack/react-query
nativewind                    zustand
```

### GLB kesh strategiyasi

```
Svayp → GLB kerak
  1. Xotira keshi?  → ha: darhol
  2. Disk keshi?    → ha: ~50 ms (expo-file-system)
  3. R2 CDN         → 300-800 ms
  4. Diskka saqla + xotiraga qo'y
  5. Limit 200 MB — LRU bo'yicha eskisini o'chir
```

---

## 9. Xarita

### Nima kerak emas

Places API, Autocomplete, Nearby Search, Place Details — **hech biri**. Do'konlar sizning PostGIS bazangizda, qidiruv sizning serveringizda.

### Nima kerak

| Vazifa | Yechim | Xarajat |
|---|---|---|
| Mobil xarita chizish | Google Maps SDK (`react-native-maps`) | **$0 cheksiz** |
| Web panel xaritasi | Google Dynamic Maps | $0 (10k/oy bepul) |
| Geocoding (do'kon ro'yxatdan o'tganda) | Google Geocoding | $0 (10k/oy bepul, oyiga ~200 kerak) |
| Yo'nalish | Deep-link telefonning o'z xaritasiga | $0 |

```js
// Yo'nalish — API chaqiruvi yo'q
const url = Platform.select({
  ios:     `maps://app?daddr=${lat},${lng}`,
  android: `google.navigation:q=${lat},${lng}`
});
Linking.openURL(url);
```

### Do'kon manzilini kiritish

Autocomplete ishlatilmaydi. Do'kon egasi **xaritada nuqta qo'yadi** (pin drag). Nol chaqiruv, nol xarajat, koordinata aniqroq — ayniqsa savdo markazi ichidagi do'kon uchun.

### Xavfsizlik

- Google Cloud'da **budget alert**: $10, $50
- API kalitini cheklash: mobil → package name + SHA-1; web → HTTP referrer
- Faqat kerakli API'lar yoqiladi, Places umuman yoqilmaydi

### Nega Google (Yandex emas)

| | Dubay | Toshkent |
|---|---|---|
| Google | A'lo | Yaxshi |
| Yandex | Zaif | A'lo |
| 2GIS | Cheklangan | A'lo |

Ikkala bozorda ishlaydigan yagona variant — Google. POI sifati muhim emas, chunki do'konlar sizniki.

---

## 10. AI Designer

```
Foydalanuvchi: tadbir + kayfiyat + byudjet
      ↓
Server: mos mahsulotlarni tanlaydi (SQL filtr)
      ↓
Gemini API: "shu ro'yxatdan 3-5 ta komplekt yig'"
      ↓
JSON javob → variant_id'lar
      ↓
Ilova: komplektni avatarga kiydiradi
```

**Provayder:** Gemini free tier (Flash modellari). Kredit karta kerak emas, muddat yo'q.

**Fallback zanjiri:** Gemini → Groq → qoidaga asoslangan tanlov (LLM'siz). Bepul tarifda SLA yo'q, 429 xatosi bo'lishi mumkin — ilova hech qachon bo'sh ekran ko'rsatmasligi kerak.

**Maxfiylik qoidasi:** bepul tarifdagi so'rovlar model o'qitishda ishlatilishi mumkin. Shuning uchun LLM'ga **hech qachon** yuborilmaydi: foydalanuvchi ismi, telefoni, o'lchamlari, fotosi. Faqat: tadbir turi, kayfiyat, byudjet, mahsulot ro'yxati (id + nom + kategoriya + narx).

---

## 11. Web panellar (Vite + React + Tailwind)

| Panel | Domen | Tarkib |
|---|---|---|
| Landing | `looksave.app` | Marketing, do'konlar uchun taklif, ilova havolalari |
| Do'kon kabineti | `store.looksave.app` | Dashboard, mahsulot, buyurtma, analitika, balans, 3D so'rov |
| Admin | `admin.looksave.app` | Do'kon tasdiqlash, moderatsiya, 3D navbat, komissiya, umumiy analitika |

---

## 12. Infratuzilma

### VPS

**Hetzner CPX41** yoki **CCX23** — 8 vCPU, 16 GB RAM, 240 GB NVMe, ~€30/oy.

### docker-compose.yml (sxema)

```yaml
services:
  caddy:      # TLS, reverse proxy
  api:        # Node + Express
  postgres:   # postgis/postgis:16
  redis:      # redis:7-alpine
  backup:     # kunlik pg_dump → R2
```

### Domenlar

```
api.looksave.app     → Node backend
cdn.looksave.app     → Cloudflare R2 (custom domain)
store.looksave.app   → do'kon kabineti
admin.looksave.app   → admin panel
looksave.app         → landing
```

### Tashqi servislar

| Servis | Nima uchun | Boshlang'ich narx |
|---|---|---|
| Cloudflare R2 | GLB, rasm, backup | $0 (10 GB + egress $0) |
| Google Maps | Xarita | $0 |
| Gemini API | AI Designer | $0 |
| Eskiz.uz / Twilio | SMS OTP | ~$10/oy |
| Expo Push | Bildirishnoma | $0 |
| Telegram Bot API | Sotuvchiga buyurtma xabari | $0 |
| Sentry | Xato kuzatuvi | $0 (bepul tarif) |
| GitHub Actions + EAS | CI/CD | $0 (bepul kvota) |

### Backup

```
Kunlik   → pg_dump → R2 (30 kun saqlanadi)
Haftalik → VPS snapshot (Hetzner, ~€1/oy)
Oylik    → to'liq nusxa boshqa provayderga
```

**Bu eng muhim band.** Bitta VPS = bitta xavf nuqtasi. Backup bo'lmasa, bir kunda hamma narsa yo'qoladi.

---

## 13. Oylik xarajat

| Modda | Faza 1-2 | 10k foydalanuvchi |
|---|---|---|
| VPS | €30 | €60-100 |
| R2 + CDN | $0 | $2-15 |
| Xarita | $0 | $0 |
| Gemini | $0 | $30-150 |
| GPU | $0 | $0-200 |
| SMS (faqat eslatma) | ~$5 | $20-60 |
| Telegram bot | $0 | $0 |
| Monitoring | $0 | $0-30 |
| **Jami** | **~$40** | **$150-650** |

---

## 14. Fazalar

### Faza 1 — Prototip (2 oy)
Auth, jins, o'lchamlar · Geo: xarita, yaqin do'konlar, do'kon profili · Katalog · 3D Try-On: standart avatar + **5-10 demo model**, svayp, morph · Savat + **buyurtma so'rovi** · Sotuvchi paneli (minimal: buyurtmalar ro'yxati, tasdiqlash/rad etish) · **Telegram bot** · Oddiy admin · TestFlight/APK

### Faza 2 — MVP (+3 oy)
Face scan → tekstura · To'liq buyurtma oqimi (barcha statuslar, cron, eslatmalar) · Do'kon kabineti to'liq · 3D katalog 40-60 mahsulot · Animatsiyalar · Push, wishlist, look'lar · Do'kon reytingi va javob tezligi · App Store / Play Market

### Faza 3 — To'liq (+3-4 oy)
AI Designer · Analitika · **Onlayn to'lov** (Payme/Click/Telr) · Komissiya undirish, payout · 3D katalog 150+ · Chuqur optimizatsiya · Sharh, reyting

### Keyingi
AR / smart mirror · Web try-on · Token / NFT (yuridik qism alohida)

---

## 15. Risklar

| Risk | Yechim |
|---|---|
| 3D modellar vaqt yeydi | Katalogni cheklash, bosqichma-bosqich |
| Eski Android'da qotadi | LOD, avtomatik sifat pasaytirish, 2D fallback |
| Yuz "uncanny valley" | Stilizatsiyalangan realistik uslub |
| VPS o'chdi | Kunlik backup + snapshot; Faza 3'da ajratish |
| Do'konda 3D model yo'q | 3D'siz mahsulot ham ko'rinadi, "try-on bor" belgisi |
| Gemini limiti tugadi | Groq → qoidaga asoslangan fallback |
| Google Maps hisobi oshdi | Budget alert, kalit cheklovi, Places yoqilmagan |
| Brend logolari (Nike, Gucci) | Shartnomasiz ishlatilmaydi |
| **Soxta buyurtma** (to'lov yo'q) | 4 qatlam: format validatsiya + OTP bog'lanishi + do'kon bloki (3 do'kon → global) + xulq limiti |
| Do'kon xato bloklab qo'ydi | Global blok faqat 3 do'kondan keyin; admin bekor qila oladi |
| **Sotuvchi javob bermaydi** | Telegram bot + 15 daq SMS + 24 soat expiry + reytingga ta'sir |
| **Mijoz kelmadi** | Sotuvchida "kelmadi" tugmasi → trust ballga ta'sir |
| Komissiya undirilmaydi | Faza 1-2 da ataylab — do'kon jalb qilish argumenti |

---

## 16. Shartnoma bandlari

**Narxga kirmaydi:** VPS va bulut xarajatlari · AI/API to'lovlari · Apple Developer ($99/yil), Google Play ($25) · To'lov tizimi komissiyasi · Fotosessiya va kontent · Brend litsenziyalari

**Alohida faza:** **Onlayn to'lov tizimi integratsiyasi** · AR / smart mirror · Token / NFT / digital shares · Web try-on

**To'lov haqida alohida band:** Faza 1-2 da ilova onlayn to'lovni qabul qilmaydi. Buyurtma sotuvchiga so'rov sifatida yuboriladi, hisob-kitob mijoz va do'kon o'rtasida amalga oshiriladi. LookSave pul harakatida ishtirok etmaydi va tomonlar o'rtasidagi hisob-kitob uchun javobgar emas.

**3D modellar:** Faza narxiga [N] ta model kiradi · Qo'shimcha model — alohida narx · Mahsulot fotolari mijoz tomonidan sifatli holda beriladi

**Ko'lam o'zgarishi:** Yangi funksiya = alohida kelishuv va narx · Yozma tasdiqsiz ish boshlanmaydi
