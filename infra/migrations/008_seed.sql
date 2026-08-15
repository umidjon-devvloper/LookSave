-- 008_seed.sql
-- Boshlang'ich ma'lumot: kategoriyalar daraxti va brendlar.
-- docs/02-database.md §9
--
-- Bu fayl productionda ham ishlaydi (test do'konlari bu yerda YO'Q —
-- ular infra/seeds/dev_seed.sql da, faqat dev muhiti uchun).

INSERT INTO categories (id, parent_id, slug, name, slot, size_type, sort_order) VALUES
-- Ildizlar
('11111111-0000-0000-0000-000000000001', NULL, 'tops',
 '{"uz":"Ustki kiyim","ru":"Верхняя одежда","en":"Tops"}', 'top', 'clothing', 1),
('11111111-0000-0000-0000-000000000002', NULL, 'bottoms',
 '{"uz":"Pastki kiyim","ru":"Низ","en":"Bottoms"}', 'bottom', 'clothing', 2),
('11111111-0000-0000-0000-000000000003', NULL, 'shoes',
 '{"uz":"Oyoq kiyim","ru":"Обувь","en":"Shoes"}', 'feet', 'shoes', 3),
('11111111-0000-0000-0000-000000000004', NULL, 'headwear',
 '{"uz":"Bosh kiyim","ru":"Головные уборы","en":"Headwear"}', 'head', 'onesize', 4),
('11111111-0000-0000-0000-000000000005', NULL, 'accessories',
 '{"uz":"Aksessuar","ru":"Аксессуары","en":"Accessories"}', NULL, 'onesize', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name, slot, size_type, sort_order) VALUES
-- Ustki kiyim
('11111111-0000-0000-0000-000000000001', 'tshirt',
 '{"uz":"Futbolka","ru":"Футболка","en":"T-Shirt"}', 'top', 'clothing', 1),
('11111111-0000-0000-0000-000000000001', 'shirt',
 '{"uz":"Ko''ylak","ru":"Рубашка","en":"Shirt"}', 'top', 'clothing', 2),
('11111111-0000-0000-0000-000000000001', 'hoodie',
 '{"uz":"Xudi","ru":"Худи","en":"Hoodie"}', 'top', 'clothing', 3),
('11111111-0000-0000-0000-000000000001', 'sweater',
 '{"uz":"Sviter","ru":"Свитер","en":"Sweater"}', 'top', 'clothing', 4),
('11111111-0000-0000-0000-000000000001', 'jacket',
 '{"uz":"Kurtka","ru":"Куртка","en":"Jacket"}', 'outer', 'clothing', 5),
('11111111-0000-0000-0000-000000000001', 'coat',
 '{"uz":"Palto","ru":"Пальто","en":"Coat"}', 'outer', 'clothing', 6),
-- Pastki kiyim
('11111111-0000-0000-0000-000000000002', 'jeans',
 '{"uz":"Jinsi","ru":"Джинсы","en":"Jeans"}', 'bottom', 'clothing', 1),
('11111111-0000-0000-0000-000000000002', 'trousers',
 '{"uz":"Shim","ru":"Брюки","en":"Trousers"}', 'bottom', 'clothing', 2),
('11111111-0000-0000-0000-000000000002', 'shorts',
 '{"uz":"Shorti","ru":"Шорты","en":"Shorts"}', 'bottom', 'clothing', 3),
('11111111-0000-0000-0000-000000000002', 'skirt',
 '{"uz":"Yubka","ru":"Юбка","en":"Skirt"}', 'bottom', 'clothing', 4),
-- Oyoq kiyim
('11111111-0000-0000-0000-000000000003', 'sneakers',
 '{"uz":"Krossovka","ru":"Кроссовки","en":"Sneakers"}', 'feet', 'shoes', 1),
('11111111-0000-0000-0000-000000000003', 'dress-shoes',
 '{"uz":"Tufli","ru":"Туфли","en":"Dress Shoes"}', 'feet', 'shoes', 2),
('11111111-0000-0000-0000-000000000003', 'boots',
 '{"uz":"Botinka","ru":"Ботинки","en":"Boots"}', 'feet', 'shoes', 3),
('11111111-0000-0000-0000-000000000003', 'sandals',
 '{"uz":"Sandal","ru":"Сандалии","en":"Sandals"}', 'feet', 'shoes', 4),
-- Bosh kiyim
('11111111-0000-0000-0000-000000000004', 'cap',
 '{"uz":"Kepka","ru":"Кепка","en":"Cap"}', 'head', 'onesize', 1),
('11111111-0000-0000-0000-000000000004', 'hat',
 '{"uz":"Shlyapa","ru":"Шляпа","en":"Hat"}', 'head', 'onesize', 2),
('11111111-0000-0000-0000-000000000004', 'beanie',
 '{"uz":"Beanie","ru":"Шапка","en":"Beanie"}', 'head', 'onesize', 3),
-- Aksessuar
('11111111-0000-0000-0000-000000000005', 'glasses',
 '{"uz":"Ko''zoynak","ru":"Очки","en":"Glasses"}', 'face', 'onesize', 1),
('11111111-0000-0000-0000-000000000005', 'watch',
 '{"uz":"Soat","ru":"Часы","en":"Watch"}', 'wrist', 'onesize', 2),
('11111111-0000-0000-0000-000000000005', 'bag',
 '{"uz":"Sumka","ru":"Сумка","en":"Bag"}', 'bag', 'onesize', 3),
('11111111-0000-0000-0000-000000000005', 'belt',
 '{"uz":"Kamar","ru":"Ремень","en":"Belt"}', NULL, 'clothing', 4),
('11111111-0000-0000-0000-000000000005', 'scarf',
 '{"uz":"Sharf","ru":"Шарф","en":"Scarf"}', 'neck', 'onesize', 5)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- BRENDLAR — hozircha shartnomasiz, is_partner = false
-- ⚠️ Logolar shartnomasiz ishlatilmaydi (00-README, 8-bo'lim)
-- ============================================================

INSERT INTO brands (name, slug, is_partner, sort_order) VALUES
('Nike','nike',false,1),
('Adidas','adidas',false,2),
('Zara','zara',false,3),
('Puma','puma',false,4),
('New Balance','new-balance',false,5),
('Uniqlo','uniqlo',false,6),
('Local Brand','local',false,99)
ON CONFLICT (slug) DO NOTHING;
