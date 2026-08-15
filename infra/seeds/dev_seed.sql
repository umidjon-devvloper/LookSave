-- dev_seed.sql — FAQAT ishlab chiqish muhiti uchun test ma'lumotlari.
-- docs/02-database.md §9 ("Test ma'lumotlari (faqat dev muhitida)")
--
-- Bu fayl `migrations/` da EMAS — migrate.sh uni ishga tushirmaydi.
-- Qo'lda:
--   docker compose -f docker-compose.dev.yml exec -T postgres \
--     psql -U looksave -d looksave -v ON_ERROR_STOP=1 < seeds/dev_seed.sql
--
-- ⚠️ Productionda ishga tushirmang.

INSERT INTO users (id, phone, full_name, role, country, gender) VALUES
('22222222-0000-0000-0000-000000000001','+998901234567','Test Sotuvchi','store_owner','UZ','male'),
('22222222-0000-0000-0000-000000000002','+971501234567','Test Seller','store_owner','AE','male')
ON CONFLICT (id) DO NOTHING;

INSERT INTO stores (owner_id, name, slug, location, address, city, country,
                    phone, currency, status, working_hours)
VALUES
('22222222-0000-0000-0000-000000000001','Chilonzor Fashion','chilonzor-fashion',
 ST_MakePoint(69.2041, 41.2756)::geography,
 'Chilonzor tumani, Bunyodkor ko''chasi 12','Toshkent','UZ',
 '+998901234567','UZS','active',
 '[{"day":1,"open":"10:00","close":"22:00"},{"day":2,"open":"10:00","close":"22:00"}]'),

('22222222-0000-0000-0000-000000000002','Dubai Mall Store','dubai-mall-store',
 ST_MakePoint(55.2796, 25.1972)::geography,
 'Dubai Mall, Ground Floor','Dubai','AE',
 '+971501234567','AED','active',
 '[{"day":1,"open":"10:00","close":"00:00"}]')
ON CONFLICT (slug) DO NOTHING;
