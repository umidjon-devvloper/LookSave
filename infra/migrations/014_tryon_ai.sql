-- 014_tryon_ai.sql
-- AI kiyintirish: foydalanuvchining o'z surati + kiyim surati -> tayyor foto.
--
-- NEGA 3D O'RNIGA: 3D maneken "realistik" darajaga chiqmaydi — buning uchun
-- o'n minglab uchburchakli model, teri ostidan yorug'lik o'tishi va haqiqiy
-- soch kerak. AI esa foydalanuvchining HAQIQIY suratini qaytaradi, ya'ni yuz
-- ham, tana ham o'ziniki. 3D jadvallari (`assets_3d`) joyida qoladi.
--
-- Migratsiya orqaga qaytmaydi. O'zgarish kerak bo'lsa — yangi raqamlangan fayl.

-- ── Foydalanuvchining to'liq bo'yli surati ────────────────────────────────
--
-- NEGA `profiles` da: bu texnik ma'lumot, `users.avatar_url` esa oddiy profil
-- rasmi va u autentifikatsiya javobida qaytariladi. Ikkalasi boshqa maqsad
-- uchun va boshqa hayot davriga ega.

ALTER TABLE profiles ADD COLUMN body_photo_url TEXT;
ALTER TABLE profiles ADD COLUMN body_photo_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.body_photo_url IS
  'To''liq bo''yli surat (R2). AI kiyintirish uchun asos. NULL bo''lsa ilova suratga taklif qiladi.';

-- ── Yasalgan suratlar keshi ──────────────────────────────────────────────
--
-- ⚠️ BU JADVAL — PUL. Har bir qator provayderga to'langan bitta so'rov.
-- Shuning uchun u kesh sifatida ishlaydi: bir odam + bir kiyim + o'sha surat
-- uchun natija BIR MARTA yasaladi va keyin shu yerdan qaytariladi.
--
-- `source_hash` aynan shu uchun kerak. Unda surat manzili va kiyim manzili
-- birga hashlanadi: foydalanuvchi yangi surat yuklasa hash o'zgaradi va
-- natija qayta yasaladi, aks holda u eski tanasi bilan qolib ketardi.

CREATE TABLE tryon_renders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_id      UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,

  -- sha256(body_photo_url + '|' + garment_image_url)
  source_hash     TEXT NOT NULL,

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','ready','failed')),

  -- Provayder nomi saqlanadi: keyinchalik almashtirilsa eski qatorlar
  -- qaysi xizmat yasaganini bilish kerak bo'ladi
  provider        TEXT NOT NULL DEFAULT 'fashn',
  provider_job_id TEXT,

  -- ⚠️ O'Z CDN'imizdagi manzil, provayderniki EMAS. Provayder havolalari
  -- vaqtinchalik va o'chib ketadi — kesh esa uzoq yashashi kerak.
  result_url      TEXT,

  error           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- Keshning kaliti. Takroriy so'rov yangi qator yasamaydi, mavjudini topadi.
CREATE UNIQUE INDEX tryon_renders_key_idx
  ON tryon_renders (user_id, variant_id, source_hash);

-- Gallereya bir so'rovda ko'p variantni so'raydi — shu index bo'yicha.
CREATE INDEX tryon_renders_user_idx
  ON tryon_renders (user_id, status);

-- Kunlik sarf chegarasi shu index orqali sanaladi.
CREATE INDEX tryon_renders_user_created_idx
  ON tryon_renders (user_id, created_at DESC);

-- Osilib qolgan ishlarni topish uchun (provayder javob bermay qolsa).
CREATE INDEX tryon_renders_pending_idx
  ON tryon_renders (status, created_at)
  WHERE status IN ('pending','processing');

COMMENT ON TABLE tryon_renders IS
  'AI kiyintirish keshi. Har qator = provayderga to''langan bitta so''rov.';
