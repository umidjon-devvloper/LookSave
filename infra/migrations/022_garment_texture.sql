-- 022_garment_texture.sql
--
-- Kiyim uchun MAHSULOT SURATI havolasi (12-tz.md, "kiyim" ishi).
--
-- ⚠️ NEGA GLB'GA EMBED EMAS, ALOHIDA HAVOLA. RN/Hermes GLB ichidagi JPEG
-- teksturani dekod qila olmaydi: `GLTFLoader` embed rasm uchun blob URL
-- yasaydi, RN esa uni ocholmaydi — tekstura jimgina tushmaydi va kiyim
-- tekis rang bo'lib qoladi. Ishlaydigan yagona yo'l: ilova suratni
-- ALOHIDA yuklab, `jpeg-js` (sof JS, Hermes'da ishlaydi) bilan dekod
-- qilib, xom piksel `DataTexture` sifatida qo'llaydi.
--
-- Shu ustun ilovaga qaysi suratni dekod qilishini aytadi. NULL bo'lsa
-- kiyim rangli qolip (surat proyeksiyasi bo'lmagan).
--
-- Planar UV kiyim GLB'sida (`projectPhoto.mjs`), surat esa shu havolada —
-- ikkalasi birga to'g'ri ko'rinish beradi.

ALTER TABLE assets_3d
  ADD COLUMN IF NOT EXISTS texture_url TEXT;

COMMENT ON COLUMN assets_3d.texture_url IS
  'Mahsulot surati havolasi — ilova uni yuklab, jpeg-js bilan dekod qilib '
  'kiyim old tomoniga qo''yadi (planar UV GLB''da). NULL = rangli qolip.';
