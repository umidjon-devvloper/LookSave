/**
 * seed-real-catalog.ts — ko'p do'kon + mahsulotni bitta JSON'dan PROD'ga yozadi.
 *
 * NIMA QILADI:
 *   1. Egani (owner) `ownerPhone` bo'yicha topadi (mavjud akkaunt bo'lishi kerak).
 *   2. Har do'konni slug bo'yicha topadi; yo'q bo'lsa — YARATADI va `active` qiladi
 *      (panel arizasidek: store_members = owner, egasining roli store_owner).
 *   3. Har mahsulotni `createProduct` orqali qo'shadi (slot kategoriyadan,
 *      variant_stock, tekshiruvlar — hammasi panel yaratganidek to'g'ri).
 *
 * ⚠️ `createProduct` ISHLATILADI, SQL EMAS — seed prod paneli yaratganidan
 * farq qilmasligi uchun.
 *
 * ⚠️ TAKROR YOZMAYDI: xuddi shu SARLAVHALI mahsulot do'konda bo'lsa tashlanadi;
 * xuddi shu slug'li do'kon bo'lsa qayta yaratilmaydi. Skriptni qayta ishga
 * tushirish xavfsiz (yangi do'kon/mahsulotlar qo'shilaveradi).
 *
 * Ishga tushirish (VPS'da, prod .env bilan, apps/api ichidan):
 *
 *   npm run seed:real --workspace=apps/api -- --file=catalog.json          # quruq yurish (rejani ko'rsatadi)
 *   npm run seed:real --workspace=apps/api -- --file=catalog.json --apply  # haqiqatan yozadi
 */

import { readFileSync } from 'node:fs';

import type { CreateProductInput } from '@looksave/validation';

import { pool } from '../src/db/pool';
import { createProduct } from '../src/store/products';

interface SeedProduct {
  title: string;
  description?: string | null;
  categorySlug: string;
  gender: 'male' | 'female' | 'unisex';
  basePrice: string; // masalan "199000"
  oldPrice?: string | null;
  images: string[]; // kamida 1 ta URL; tekshiruvga (pending) kamida 3 ta kerak
  tags?: string[];
  isLimited?: boolean;
  /** Rang (ixtiyoriy). Berilmasa bitta nomsiz variant bo'ladi. */
  colorHex?: string | null;
  colorName?: Record<string, string> | null;
  /** O'lchamlar va qoldiq. onesize kategoriyalar uchun: [{size:"onesize",stock:N}] */
  sizes: Array<{ size: string; stock: number }>;
}

interface SeedStore {
  name: string;
  slug: string;
  city: string;
  address: string;
  landmark?: string | null;
  phone: string;
  lat: number;
  lng: number;
  logoUrl?: string | null;
  description?: string | null;
  currency?: 'UZS' | 'AED' | 'USD';
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  products: SeedProduct[];
}

interface SeedFile {
  /** Barcha do'konlarning egasi — PROD'da MAVJUD akkaunt telefoni. */
  ownerPhone: string;
  stores: SeedStore[];
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const file = arg('file');
  if (!file) throw new Error('--file=<catalog.json> majburiy');

  const data = JSON.parse(readFileSync(file, 'utf8')) as SeedFile;

  // Ega
  const ownerRes = await pool.query<{ id: string; full_name: string | null }>(
    `SELECT id, full_name FROM users WHERE phone = $1`,
    [data.ownerPhone],
  );
  const owner = ownerRes.rows[0];
  if (!owner) {
    throw new Error(
      `Owner topilmadi: ${data.ownerPhone} — avval shu raqam bilan akkaunt yarating (ilovada).`,
    );
  }
  console.log(`👤 Owner: ${owner.full_name ?? '—'} (${owner.id})`);

  // Kategoriya slug -> id
  const catRes = await pool.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM categories WHERE slug IS NOT NULL`,
  );
  const catBySlug = new Map(catRes.rows.map((r) => [r.slug, r.id]));

  let storesCreated = 0;
  let productsAdded = 0;
  let productsSkipped = 0;
  const missingCats = new Set<string>();

  for (const s of data.stores) {
    console.log(`\n🏬 ${s.name} (${s.slug})`);

    // Do'kon bormi?
    let storeRes = await pool.query<{ id: string; status: string }>(
      `SELECT id, status FROM stores WHERE slug = $1`,
      [s.slug],
    );
    let store = storeRes.rows[0];

    if (!store) {
      if (APPLY) {
        const ins = await pool.query<{ id: string }>(
          `INSERT INTO stores (owner_id, name, slug, description, location, address, landmark,
                               city, country, phone, working_hours, delivery_enabled,
                               pickup_enabled, currency, status)
           VALUES ($1,$2,$3,$4, ST_MakePoint($5,$6)::geography, $7,$8,$9,'UZ',$10,$11,$12,$13,$14,'active')
           RETURNING id`,
          [
            owner.id,
            s.name,
            s.slug,
            s.description ?? null,
            s.lng,
            s.lat,
            s.address,
            s.landmark ?? null,
            s.city,
            s.phone,
            JSON.stringify(
              // sukut: har kuni 10:00–21:00 ochiq
              [1, 2, 3, 4, 5, 6, 7].map((day) => ({
                day,
                open: '10:00',
                close: '21:00',
                closed: false,
              })),
            ),
            s.deliveryEnabled ?? true,
            s.pickupEnabled ?? true,
            s.currency ?? 'UZS',
          ],
        );
        const newId = ins.rows[0]!.id;
        await pool.query(
          `INSERT INTO store_members (store_id, user_id, role) VALUES ($1,$2,'owner')
           ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'owner'`,
          [newId, owner.id],
        );
        if (s.logoUrl) {
          await pool.query(`UPDATE stores SET logo_url = $2 WHERE id = $1`, [newId, s.logoUrl]);
        }
        store = { id: newId, status: 'active' };
        storesCreated += 1;
        console.log(`   ✓ do'kon yaratildi (active)`);
      } else {
        console.log(`   + do'kon YARATILADI (active)`);
        // quruq yurishda mahsulotlarni ham faqat sanab ko'rsatamiz
        for (const p of s.products) console.log(`      · "${p.title}" [${p.categorySlug}]`);
        continue;
      }
    } else {
      console.log(`   = mavjud do'kon (${store.status})`);
      if (store.status !== 'active') {
        console.log(`   ⚠  faol emas — mahsulot qo'shib bo'lmaydi, tashlab ketildi`);
        continue;
      }
    }

    // Egalik rolini ko'tarish (customer bo'lsa)
    if (APPLY) {
      await pool.query(`UPDATE users SET role = 'store_owner' WHERE id = $1 AND role = 'customer'`, [
        owner.id,
      ]);
    }

    // Mavjud mahsulot sarlavhalari
    const existingRes = await pool.query<{ title: string }>(
      `SELECT title FROM products WHERE store_id = $1`,
      [store.id],
    );
    const existing = new Set(existingRes.rows.map((r) => r.title.trim().toLowerCase()));

    for (const p of s.products) {
      const categoryId = catBySlug.get(p.categorySlug);
      if (!categoryId) {
        missingCats.add(p.categorySlug);
        console.log(`   ⚠  "${p.title}" — "${p.categorySlug}" kategoriyasi yo'q, tashlandi`);
        continue;
      }
      if (existing.has(p.title.trim().toLowerCase())) {
        productsSkipped += 1;
        continue;
      }

      const input: CreateProductInput = {
        title: p.title,
        description: p.description ?? undefined,
        categoryId,
        gender: p.gender,
        basePrice: p.basePrice,
        oldPrice: p.oldPrice ?? undefined,
        images: p.images,
        tags: p.tags ?? [],
        isLimited: p.isLimited ?? false,
        status: 'pending', // createProduct uni darhol 'active' qiladi
        variants: [
          {
            colorHex: p.colorHex ?? undefined,
            colorName:
              (p.colorName as CreateProductInput['variants'][number]['colorName']) ?? undefined,
            images: p.images,
            priceDelta: '0',
            sizes: p.sizes,
          },
        ],
      };

      console.log(`   ${APPLY ? '＋' : '·'} "${p.title}" [${p.categorySlug}] ${p.sizes.length} o'lcham`);
      if (APPLY) {
        await createProduct(store.id, input);
        productsAdded += 1;
      }
    }
  }

  console.log(
    `\n${APPLY ? '✅ Yozildi' : '🔎 Quruq yurish'}: +${storesCreated} do'kon, +${productsAdded} mahsulot, ${productsSkipped} tashlandi`,
  );
  if (missingCats.size > 0) console.log(`⚠  Yo'q kategoriyalar: ${[...missingCats].join(', ')}`);
  if (!APPLY) console.log('\nYozish uchun --apply qo`shing.');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err);
    void pool.end();
    process.exitCode = 1;
  });
