-- 021_face_personalization.sql
--
-- Avatar YUZINI foydalanuvchiga o'xshatish (12-tz.md, "yuz" ishi).
--
-- ⚠️ NEGA KERAK. Ilgari selfi 3D bosh mesh'iga TEKSTURA bo'lib tushardi va
-- dog' bo'lib chiqardi — boshda yuz UV joylashuvi yo'q (D-41). To'g'ri usul
-- boshqa: bosh mesh'ida 8 ta YUZ SHAKLI morfi bor (`fm_*`), va selfidan
-- yuz o'lchovlari chiqarilib o'sha morflar sozlanadi. Natija — dog' emas,
-- foydalanuvchiga o'xshash STILIZATSIYA (uncanny valley'siz).
--
--   skin_tone   — selfidan olingan teri rangi (#RRGGBB). Bosh va qo'l
--                 materiali shu rangga bo'yaladi. Eng ishonchli
--                 shaxsiylashtirish: rang darhol ko'zga tashlanadi.
--   face_morphs — 8 ta fm_* morf qiymati (jsonb). Yuz nuqtalaridan
--                 hisoblanadi. Bo'sh bo'lsa yuz neytral (fm_* = 0).
--
-- ⚠️ face_morphs NEYTRALI 0, mt_* (o'lcham) NEYTRALI 0.5. Sabab:
-- `export_bodies.py` fm_* ni 0 ga qo'yadi (asos geometriya = neytral yuz),
-- mt_* ni esa 0.5 ga (o'rtaga suriladi). Ikki xil kelishuv — aralashtirilmasin.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS skin_tone   TEXT,
  ADD COLUMN IF NOT EXISTS face_morphs JSONB;

COMMENT ON COLUMN profiles.skin_tone IS
  'Selfidan olingan teri rangi #RRGGBB. Avatar bosh/qo''l materiali shunga bo''yaladi.';
COMMENT ON COLUMN profiles.face_morphs IS
  'fm_* yuz shakli morflari {faceLength, faceWidth, ...}. Neytral 0. Bo''sh bo''lsa yuz neytral.';
