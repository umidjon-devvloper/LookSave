-- 2026-11-21 — App Store 4.3(b) uchun: demo akkaunt login qilganda sotuvchi
-- paneliga emas, oddiy xaridor sahifasiga tushsin.
--
-- Oldingi holat: demo akkauntning `role = store_owner` edi. App Review
-- reviewer App Review Notes'dagi demo kirish bilan sinab ko'rganda,
-- marketplace emas, boshqaruv panelini ko'rdi. Bu 4.3(b) uchun shubhali.
--
-- Yechim: demo akkauntning rolini `customer`ga o'tkazish. Do'konga
-- a'zoligi (`store_members`) TEGILMAYDI — kerak bo'lsa rolni qaytarish
-- yetarli.
--
-- Ishga tushirish (VPS'da, prod .env bilan):
--   cd /var/www/looksave/apps/api
--   psql "$DATABASE_URL" -f scripts/sql/2026-11-21-demo-user-role.sql

BEGIN;

-- 1. Hozirgi holatni ko'rish
\echo '--- Demo akkauntning hozirgi holati ---'
SELECT id, phone, full_name, role, is_active
FROM users
WHERE phone = '+998937844572';

-- 2. Rolni o'zgartirish
UPDATE users
SET role = 'customer',
    updated_at = NOW()
WHERE phone = '+998937844572'
  AND role = 'store_owner';

-- 3. O'zgargan holatni ko'rsatish
\echo '--- O''zgargandan keyin ---'
SELECT id, phone, full_name, role, updated_at
FROM users
WHERE phone = '+998937844572';

COMMIT;

-- Qaytarish uchun (kerak bo'lsa, App Review tugagach):
--   UPDATE users SET role = 'store_owner', updated_at = NOW()
--   WHERE phone = '+998937844572';
