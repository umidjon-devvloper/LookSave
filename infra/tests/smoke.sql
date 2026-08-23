-- smoke.sql — sxema va triggerlarni tekshirish.
-- Hamma narsa tranzaksiya ichida, oxirida ROLLBACK — baza o'zgarmaydi.
--
--   docker compose -f docker-compose.dev.yml exec -T postgres \
--     psql -U looksave -d looksave -f - < tests/smoke.sql
--
-- Talab: migratsiyalar 001-008 qo'llangan bo'lsin.
--
-- ⚠️ FIKSTURA RAQAMLARI +998999000xxx — ATAYLAB "REZERV" DIAPAZON.
-- Ilgari bu yerda +998900000001 turardi va u haqiqiy akkaunt bilan
-- to'qnashdi (users.phone UNIQUE): smoke shu bazada hech qachon
-- o'tmasdi, chunki BEGIN dagi birinchi INSERT yiqilardi. Bu diapazonni
-- haqiqiy akkaunt uchun ISHLATMANG.

\set ON_ERROR_STOP on
BEGIN;

-- ── Tayyorgarlik ──
INSERT INTO users (id, phone, full_name, role, country, gender) VALUES
  ('00000000-dead-0000-0000-000000000001','+998999000001','Test Sotuvchi','store_owner','UZ','male'),
  ('00000000-dead-0000-0000-000000000002','+998999000002','Test Mijoz','customer','UZ','male');

INSERT INTO stores (id, owner_id, name, slug, location, address, city, country, phone, currency, status)
VALUES ('00000000-dead-0000-0000-000000000010','00000000-dead-0000-0000-000000000001',
        'Smoke Store','smoke-store', ST_MakePoint(69.2041, 41.2756)::geography,
        'Test manzil','Toshkent','UZ','+998999000001','UZS','active');

INSERT INTO products (id, store_id, category_id, title, slot, gender, base_price, currency, status)
SELECT '00000000-dead-0000-0000-000000000020','00000000-dead-0000-0000-000000000010', c.id,
       'Smoke futbolka','top','male','199000.00','UZS','active'
FROM categories c WHERE c.slug = 'tshirt';

INSERT INTO product_variants (id, product_id, color_hex)
VALUES ('00000000-dead-0000-0000-000000000030','00000000-dead-0000-0000-000000000020','#1a1a1a');

INSERT INTO variant_stock (variant_id, size, stock)
VALUES ('00000000-dead-0000-0000-000000000030','M',10);

-- ── 1) has_3d triggeri ──
INSERT INTO assets_3d (variant_id, status) VALUES ('00000000-dead-0000-0000-000000000030','ready');
SELECT CASE WHEN has_3d THEN 'OK  ' ELSE 'XATO' END AS natija,
       '1a asset ready → products.has_3d = true' AS test
FROM products WHERE id='00000000-dead-0000-0000-000000000020';

DELETE FROM assets_3d WHERE variant_id='00000000-dead-0000-0000-000000000030';
SELECT CASE WHEN NOT has_3d THEN 'OK  ' ELSE 'XATO' END AS natija,
       '1b asset o''chdi → has_3d = false' AS test
FROM products WHERE id='00000000-dead-0000-0000-000000000020';

-- ── 2) Buyurtma raqami, expires_at, jurnal ──
SET LOCAL app.actor_type = 'customer';
SET LOCAL app.actor_id   = '00000000-dead-0000-0000-000000000002';
SET LOCAL app.channel    = 'app';

INSERT INTO orders (id, user_id, store_id, delivery_type, contact_name, contact_phone,
                    address, subtotal, delivery_fee, total, currency)
VALUES ('00000000-dead-0000-0000-000000000040','00000000-dead-0000-0000-000000000002',
        '00000000-dead-0000-0000-000000000010','delivery','Test Mijoz','+998999000002',
        '{"text":"Bunyodkor 12","lat":41.2756,"lng":69.2041}', '199000.00','15000.00','214000.00','UZS');

SELECT CASE WHEN order_number ~ '^LS-\d{6}-\d{4}$' THEN 'OK  ' ELSE 'XATO' END AS natija,
       '2a order_number formati: ' || order_number AS test
FROM orders WHERE id='00000000-dead-0000-0000-000000000040';

SELECT CASE WHEN expires_at BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
            THEN 'OK  ' ELSE 'XATO' END AS natija,
       '2b expires_at = +24 soat' AS test
FROM orders WHERE id='00000000-dead-0000-0000-000000000040';

SELECT CASE WHEN count(*) = 1 THEN 'OK  ' ELSE 'XATO' END AS natija,
       '2c INSERT → order_events yozildi' AS test
FROM order_events WHERE order_id='00000000-dead-0000-0000-000000000040';

-- ── 3) Vaqt belgilari va trust ──
UPDATE orders SET status='seen'      WHERE id='00000000-dead-0000-0000-000000000040';
UPDATE orders SET status='confirmed' WHERE id='00000000-dead-0000-0000-000000000040';
UPDATE orders SET status='completed' WHERE id='00000000-dead-0000-0000-000000000040';

SELECT CASE WHEN seen_at IS NOT NULL AND confirmed_at IS NOT NULL
             AND completed_at IS NOT NULL AND ready_at IS NULL
            THEN 'OK  ' ELSE 'XATO' END AS natija,
       '3a vaqt belgilari to''g''ri qo''yildi' AS test
FROM orders WHERE id='00000000-dead-0000-0000-000000000040';

SELECT CASE WHEN orders_total = 1 AND orders_completed = 1 THEN 'OK  ' ELSE 'XATO' END AS natija,
       '3b user_trust yangilandi' AS test
FROM user_trust WHERE user_id='00000000-dead-0000-0000-000000000002';

-- ── 4) delivery uchun koordinata majburiyligi ──
DO $$
BEGIN
  BEGIN
    INSERT INTO orders (user_id, store_id, delivery_type, contact_name, contact_phone,
                        address, subtotal, total, currency)
    VALUES ('00000000-dead-0000-0000-000000000002','00000000-dead-0000-0000-000000000010',
            'delivery','X','+998999000002','{"text":"koordinatasiz"}','1.00','1.00','UZS');
    RAISE EXCEPTION 'XATO: koordinatasiz delivery o''tib ketdi';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK   4a koordinatasiz delivery rad etildi';
  END;
END $$;

-- ── 5) Qora ro'yxat eskalatsiyasi (3 do'kon → global) ──
INSERT INTO stores (owner_id,name,slug,location,address,city,country,phone,currency,status)
SELECT '00000000-dead-0000-0000-000000000001','Smoke '||i,'smoke-'||i,
       ST_MakePoint(69.2+i*0.01, 41.3)::geography,'a','Toshkent','UZ','+998999000001','UZS','active'
FROM generate_series(1,3) i;

INSERT INTO order_blocklist (store_id, phone, reason, created_by)
SELECT id, '+998999000099', 'smoke', 'store' FROM stores WHERE slug LIKE 'smoke-%';

SELECT CASE WHEN count(*) = 1 THEN 'OK  ' ELSE 'XATO' END AS natija,
       '5a 3 do''kon bloklagach global blok yaratildi' AS test
FROM order_blocklist WHERE phone='+998999000099' AND store_id IS NULL;

-- ── 6) Geo index (yaqin do'konlar) ──
SELECT CASE WHEN count(*) >= 1 THEN 'OK  ' ELSE 'XATO' END AS natija,
       '6a ST_DWithin 5 km ichida do''kon topildi' AS test
FROM stores
WHERE status='active'
  AND ST_DWithin(location, ST_MakePoint(69.2041, 41.2756)::geography, 5000);

ROLLBACK;
