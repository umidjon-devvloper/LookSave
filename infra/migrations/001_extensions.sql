-- 001_extensions.sql
-- Kengaytmalar. docs/02-database.md §2
-- Migratsiya orqaga qaytmaydi. O'zgarish kerak bo'lsa — yangi raqamlangan fayl.

-- PostGIS: geo-qidiruv (yaqin do'konlar)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Trigram: noaniq matn qidiruvi ("nayk" → "Nike")
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- gen_random_uuid() uchun (PG13+ da o'rnatilgan, lekin kafolat uchun)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Sekin so'rovlarni topish uchun.
-- ⚠️ Buning ishlashi uchun serverda shared_preload_libraries=pg_stat_statements
-- bo'lishi shart — infra/docker-compose.yml da o'rnatilgan.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
