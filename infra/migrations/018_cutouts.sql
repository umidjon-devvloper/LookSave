-- 018_cutouts.sql
-- Fondan ajratilgan suratlar: maketdagi qorong'i sahna uchun.
--
-- NEGA: maketda odam qorong'i sahnada, neon halqalar orasida turadi. AI esa
-- har doim och kulrang studiya foni bilan qaytaradi. Uni to'g'ridan-to'g'ri
-- qo'ysak qora ekranda och kulrang to'rtburchak paydo bo'ladi.
--
-- Shaffof kesim istalgan fonga qo'yiladi, sahna esa ilovada chiziladi va
-- hech qanday qo'shimcha xarajat talab qilmaydi.
--
-- ⚠️ QIYMAT NULL BO'LISHI MUMKIN VA BU XATO EMAS. Kesim — BEZAK: uni
-- yasashda nosozlik bo'lsa asosiy oqim to'xtamaydi, ilova esa oddiy
-- suratni ko'rsatadi.
--
-- Migratsiya orqaga qaytmaydi. O'zgarish kerak bo'lsa — yangi raqamlangan fayl.

ALTER TABLE profiles ADD COLUMN avatar_cutout_url TEXT;
ALTER TABLE tryon_renders ADD COLUMN cutout_url TEXT;

COMMENT ON COLUMN profiles.avatar_cutout_url IS
  'Avatarning shaffof kesimi (PNG). NULL — kesim yasalmagan, oddiy surat ishlatiladi.';

COMMENT ON COLUMN tryon_renders.cutout_url IS
  'Kiyintirilgan natijaning shaffof kesimi (PNG). NULL bo''lishi mumkin.';
