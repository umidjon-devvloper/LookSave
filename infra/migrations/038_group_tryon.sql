-- 038_group_tryon.sql
-- «Do'stlar bilan birga sinash» — foydalanuvchi try-on natijasini do'stiga
-- ulashadi, do'st esa emoji orqali ovoz beradi. Tier 1 funksiyasi №01.
--
-- ⚠️ IKKI JADVAL BIR MIGRATSIYADA, chunki ikkisi ham mavjud bo'lmasa oqim
-- ishlamaydi va alohida qadamlar faqat deploy'ni murakkablashtiradi.
--
-- ⚠️ SESSIYA BIR MARTA YASALADI VA UZOQ QOLADI (30 kun). Ovoz berish
-- anonim qurilma barmog'i bo'yicha (akkaunt shart emas — do'st ilovaga
-- yangi kirmasligi uchun). Bitta qurilma bir sessiyaga bir marta ovoz
-- beradi, lekin emoji o'zgartirish mumkin (UPSERT).

CREATE TABLE group_tryon_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  render_id       UUID NOT NULL REFERENCES tryon_renders(id) ON DELETE CASCADE,
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Snapshot — render o'chirilganda ham ovozlar qolishi uchun
  image_url       TEXT NOT NULL,
  caption         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX group_tryon_sessions_creator_idx
  ON group_tryon_sessions (creator_user_id, created_at DESC);

-- ⚠️ ODDIY INDEKS, shartsiz. `WHERE expires_at > now()` yozib bo'lmaydi:
-- `now()` IMMUTABLE emas va Postgres «functions in index predicate must be
-- marked IMMUTABLE» bilan butun migratsiyani rad etadi.
CREATE INDEX group_tryon_sessions_expires_idx
  ON group_tryon_sessions (expires_at);

-- ============================================================
-- OVOZLAR
-- ============================================================
--
-- ⚠️ `voter_fingerprint` — anonim qurilma barmog'i (X-Device-Id sarlavhasi
-- yoki IP+UA sha256). Akkauntsiz do'st ham ovoz beradi. UNIQUE qurilma +
-- sessiya bo'yicha; `emoji` UPSERT bilan yangilanadi.

CREATE TABLE group_tryon_votes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES group_tryon_sessions(id) ON DELETE CASCADE,
  voter_fingerprint  TEXT NOT NULL,
  voter_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Besh variant: like, love, fire, cool, no
  emoji              TEXT NOT NULL CHECK (emoji IN ('like','love','fire','cool','no')),
  comment            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX group_tryon_votes_unique_voter_idx
  ON group_tryon_votes (session_id, voter_fingerprint);

CREATE INDEX group_tryon_votes_session_idx
  ON group_tryon_votes (session_id, created_at DESC);

COMMENT ON TABLE group_tryon_sessions IS
  'Do''stlar bilan try-on ulashish sessiyasi. 30 kunga yaroqli, tozalanadi.';
COMMENT ON TABLE group_tryon_votes IS
  'Sessiyaga kelgan emoji ovozlari. Bitta qurilma = bitta ovoz (UPSERT).';
