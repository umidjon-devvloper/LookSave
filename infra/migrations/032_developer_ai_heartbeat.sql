-- 032_developer_ai_heartbeat.sql
-- Operator ishining «tirik» belgisi.
--
-- Bir nechta operator (yoki bir nechta brauzer kengaytmasi) bitta
-- navbatdan ishlaydi. Ish band qilinadi va faqat band qilgan odam
-- natijani topshira oladi — bu allaqachon bor. Yetishmagani: band
-- qilgan tomon O'LIB QOLSA ish abadiy uning nomida qoladi va navbat
-- tiqilib qolardi.
--
-- ⚠️ NEGA `claimed_at` NI YANGILAB BO'LMAYDI. U ish QACHON olinganini
-- bildiradi va panel undan «qancha kutdi» ni hisoblaydi (`toDto` —
-- `waitingSeconds`). Uni har daqiqada yangilasak, kutish vaqti har
-- safar nolga tushib, ko'rsatkich yolg'on bo'lardi.
--
-- ⚠️ NEGA UMUMAN KERAK. Avatar ishi SOATLAB davom etishi mumkin —
-- bitta gavda va o'nlab kiyim. Ya'ni «10 daqiqadan oshdi — bo'shat»
-- degan oddiy qoida TIRIK ishni tortib olardi. Tirik belgi esa
-- ishlayotganni ishlamayotganidan ajratadi.

ALTER TABLE developer_ai_tasks ADD COLUMN heartbeat_at TIMESTAMPTZ;

-- Supuruvchi faqat `claimed` qatorlarni ko'radi
CREATE INDEX developer_ai_tasks_heartbeat_idx
  ON developer_ai_tasks (heartbeat_at)
  WHERE status = 'claimed';
